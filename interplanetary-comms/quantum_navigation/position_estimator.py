"""Position estimator using EKF with magnetic field data.

This module provides position estimation capabilities using the Extended
Kalman Filter from the quantum-magnetic navigation system.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple, Any, Callable
from dataclasses import dataclass
import time
import math

# Import from the quantum-magnetic-navigation codebase
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../quantum-magnetic-navigation/src'))

from qmag_nav.filter.ekf import NavEKF
from qmag_nav.mapping.backend import load_map, cached_interpolate
from qmag_nav.models.geo import LatLon, MagneticVector
from qmag_nav.models.sensor import MagnetometerReading

logger = logging.getLogger(__name__)


@dataclass
class EstimationParameters:
    """Parameters for position estimation."""
    process_noise: float = 0.01
    measurement_noise: float = 0.05
    position_uncertainty: float = 1.0
    velocity_uncertainty: float = 0.01
    magnetic_map_path: Optional[str] = None
    interpolation_method: str = "bilinear"


@dataclass
class EstimationResult:
    """Result of position estimation."""
    position: LatLon
    velocity_deg: Tuple[float, float]  # degrees/second
    velocity_ms: Tuple[float, float]   # meters/second
    position_uncertainty: Tuple[float, float]
    velocity_uncertainty: Tuple[float, float]
    quality_score: float
    timestamp: float
    convergence_status: str
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "position": {
                "latitude": self.position.lat,
                "longitude": self.position.lon
            },
            "velocity": {
                "degrees_per_second": {
                    "lat": self.velocity_deg[0],
                    "lon": self.velocity_deg[1]
                },
                "meters_per_second": {
                    "north": self.velocity_ms[0],
                    "east": self.velocity_ms[1]
                }
            },
            "uncertainty": {
                "position": {
                    "latitude": self.position_uncertainty[0],
                    "longitude": self.position_uncertainty[1]
                },
                "velocity": {
                    "lat": self.velocity_uncertainty[0],
                    "lon": self.velocity_uncertainty[1]
                }
            },
            "quality_score": self.quality_score,
            "timestamp": self.timestamp,
            "convergence_status": self.convergence_status
        }


class PositionEstimator:
    """Advanced position estimator using EKF with magnetic field measurements.
    
    This class provides sophisticated position estimation capabilities by
    integrating magnetic field measurements with Extended Kalman Filter
    for robust position tracking in interplanetary communications.
    """
    
    def __init__(self, parameters: EstimationParameters):
        """Initialize the position estimator.
        
        Args:
            parameters: Estimation parameters
        """
        self.parameters = parameters
        self.ekf: Optional[NavEKF] = None
        self.magnetic_map = None
        self.is_initialized = False
        
        # Estimation statistics
        self.total_updates = 0
        self.successful_updates = 0
        self.convergence_history: List[float] = []
        self.innovation_history: List[float] = []
        
        # Load magnetic map if provided
        if parameters.magnetic_map_path:
            self._load_magnetic_map(parameters.magnetic_map_path)
    
    def _load_magnetic_map(self, map_path: str) -> bool:
        """Load magnetic field map.
        
        Args:
            map_path: Path to the magnetic map file
            
        Returns:
            True if loaded successfully, False otherwise
        """
        try:
            self.magnetic_map = load_map(map_path)
            logger.info(f"Loaded magnetic map from {map_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to load magnetic map: {e}")
            return False
    
    def initialize(
        self,
        initial_position: LatLon,
        initial_velocity: Optional[Tuple[float, float]] = None,
        initial_covariance: Optional[List[List[float]]] = None
    ) -> bool:
        """Initialize the position estimator.
        
        Args:
            initial_position: Initial position estimate
            initial_velocity: Initial velocity estimate (dlat, dlon) in degrees/second
            initial_covariance: Initial covariance matrix (4x4)
            
        Returns:
            True if initialization successful, False otherwise
        """
        try:
            # Create default covariance if not provided
            if initial_covariance is None:
                initial_covariance = [
                    [self.parameters.position_uncertainty, 0.0, 0.0, 0.0],
                    [0.0, self.parameters.position_uncertainty, 0.0, 0.0],
                    [0.0, 0.0, self.parameters.velocity_uncertainty, 0.0],
                    [0.0, 0.0, 0.0, self.parameters.velocity_uncertainty],
                ]
            
            # Initialize EKF
            self.ekf = NavEKF(
                initial=initial_position,
                initial_velocity=initial_velocity,
                covariance=initial_covariance,
                process_noise=self.parameters.process_noise
            )
            
            self.is_initialized = True
            logger.info(f"Position estimator initialized at {initial_position}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize position estimator: {e}")
            return False
    
    def update(
        self,
        magnetic_reading: MagnetometerReading,
        dt: float,
        imu_data: Optional[Dict[str, Any]] = None
    ) -> Optional[EstimationResult]:
        """Update position estimate with new measurement.
        
        Args:
            magnetic_reading: Magnetometer reading
            dt: Time step since last update in seconds
            imu_data: Optional IMU data for improved prediction
            
        Returns:
            Estimation result or None if update failed
        """
        if not self.is_initialized or not self.ekf:
            logger.warning("Position estimator not initialized")
            return None
        
        try:
            self.total_updates += 1
            
            # Predict step
            if imu_data and self._has_imu_data(imu_data):
                self._predict_with_imu(dt, imu_data)
            else:
                self.ekf.predict(dt)
            
            # Update step with magnetic measurement
            if self.magnetic_map:
                innovation = self._update_with_magnetic_field(magnetic_reading)
                self.innovation_history.append(abs(innovation))
                
                # Limit history size
                if len(self.innovation_history) > 100:
                    self.innovation_history.pop(0)
            
            # Get estimation results
            result = self._create_estimation_result()
            
            # Update statistics
            self.successful_updates += 1
            self._update_convergence_statistics(result)
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to update position estimate: {e}")
            return None
    
    def _has_imu_data(self, imu_data: Dict[str, Any]) -> bool:
        """Check if IMU data is complete for prediction.
        
        Args:
            imu_data: IMU data dictionary
            
        Returns:
            True if IMU data is usable, False otherwise
        """
        return (
            'acceleration' in imu_data and
            'gyroscope' in imu_data and
            'north' in imu_data['acceleration'] and
            'east' in imu_data['acceleration'] and
            'yaw' in imu_data['gyroscope']
        )
    
    def _predict_with_imu(self, dt: float, imu_data: Dict[str, Any]):
        """Predict using IMU data.
        
        Args:
            dt: Time step in seconds
            imu_data: IMU data dictionary
        """
        accel = (
            imu_data['acceleration']['north'],
            imu_data['acceleration']['east']
        )
        gyro = imu_data['gyroscope']['yaw']
        
        # Get noise parameters from IMU data or use defaults
        accel_noise = imu_data.get('acceleration_noise', 0.1)
        gyro_noise = imu_data.get('gyroscope_noise', 0.01)
        
        self.ekf.predict_with_imu(dt, accel, gyro, accel_noise, gyro_noise)
    
    def _update_with_magnetic_field(self, magnetic_reading: MagnetometerReading) -> float:
        """Update EKF with magnetic field measurement.
        
        Args:
            magnetic_reading: Magnetometer reading
            
        Returns:
            Innovation (measurement residual)
        """
        # Get current position for expected measurement
        current_position = self.ekf.estimate()
        
        # Define magnetic field lookup function
        def mag_map_func(lat: float, lon: float) -> float:
            try:
                return cached_interpolate(
                    self.magnetic_map, 
                    lat, 
                    lon, 
                    self.parameters.interpolation_method
                )
            except ValueError:
                logger.warning(f"Position ({lat}, {lon}) outside magnetic map bounds")
                return 0.0
        
        # Get expected measurement
        expected_field = mag_map_func(current_position.lat, current_position.lon)
        
        # Calculate innovation
        observed_field = magnetic_reading.magnitude()
        innovation = observed_field - expected_field
        
        # Perform EKF update
        if hasattr(magnetic_reading, 'bx') and hasattr(magnetic_reading, 'by') and hasattr(magnetic_reading, 'bz'):
            # Use vector update if full vector is available
            mag_vector = MagneticVector(
                bx=magnetic_reading.bx,
                by=magnetic_reading.by,
                bz=magnetic_reading.bz
            )
            
            def mag_vector_func(lat: float, lon: float) -> MagneticVector:
                # For simplicity, return a scaled version of the magnitude
                magnitude = mag_map_func(lat, lon)
                return MagneticVector(bx=magnitude, by=0.0, bz=0.0)
            
            self.ekf.update_vector(mag_vector, mag_vector_func, self.parameters.measurement_noise)
        else:
            # Use scalar update
            self.ekf.update(observed_field, mag_map_func, self.parameters.measurement_noise)
        
        return innovation
    
    def _create_estimation_result(self) -> EstimationResult:
        """Create estimation result from current EKF state.
        
        Returns:
            Estimation result
        """
        position = self.ekf.estimate()
        velocity_deg = self.ekf.velocity()
        velocity_ms = self.ekf.velocity_ms()
        pos_uncertainty = self.ekf.position_uncertainty()
        vel_uncertainty = self.ekf.velocity_uncertainty()
        
        # Calculate quality score based on uncertainties
        quality_score = self._calculate_quality_score(pos_uncertainty, vel_uncertainty)
        
        # Determine convergence status
        convergence_status = self._assess_convergence_status(pos_uncertainty)
        
        return EstimationResult(
            position=position,
            velocity_deg=velocity_deg,
            velocity_ms=velocity_ms,
            position_uncertainty=pos_uncertainty,
            velocity_uncertainty=vel_uncertainty,
            quality_score=quality_score,
            timestamp=time.time(),
            convergence_status=convergence_status
        )
    
    def _calculate_quality_score(
        self, 
        pos_uncertainty: Tuple[float, float], 
        vel_uncertainty: Tuple[float, float]
    ) -> float:
        """Calculate quality score based on uncertainties.
        
        Args:
            pos_uncertainty: Position uncertainties (lat, lon)
            vel_uncertainty: Velocity uncertainties (dlat, dlon)
            
        Returns:
            Quality score between 0.0 and 1.0
        """
        # Combine position and velocity uncertainties
        pos_unc = math.sqrt(pos_uncertainty[0]**2 + pos_uncertainty[1]**2)
        vel_unc = math.sqrt(vel_uncertainty[0]**2 + vel_uncertainty[1]**2)
        
        # Normalize uncertainties (these thresholds may need tuning)
        pos_score = 1.0 / (1.0 + pos_unc)
        vel_score = 1.0 / (1.0 + vel_unc * 10.0)  # Scale velocity uncertainty
        
        # Weighted combination
        return 0.7 * pos_score + 0.3 * vel_score
    
    def _assess_convergence_status(self, pos_uncertainty: Tuple[float, float]) -> str:
        """Assess convergence status based on position uncertainty.
        
        Args:
            pos_uncertainty: Position uncertainties (lat, lon)
            
        Returns:
            Convergence status string
        """
        max_uncertainty = max(pos_uncertainty)
        
        if max_uncertainty < 0.001:  # Very precise
            return "excellent"
        elif max_uncertainty < 0.01:  # Good precision
            return "good"
        elif max_uncertainty < 0.1:   # Moderate precision
            return "moderate"
        elif max_uncertainty < 1.0:   # Poor precision
            return "poor"
        else:
            return "diverging"
    
    def _update_convergence_statistics(self, result: EstimationResult):
        """Update convergence statistics.
        
        Args:
            result: Latest estimation result
        """
        self.convergence_history.append(result.quality_score)
        
        # Limit history size
        if len(self.convergence_history) > 100:
            self.convergence_history.pop(0)
    
    def get_estimation_statistics(self) -> Dict[str, Any]:
        """Get comprehensive estimation statistics.
        
        Returns:
            Dictionary containing estimation statistics
        """
        success_rate = (self.successful_updates / self.total_updates) if self.total_updates > 0 else 0.0
        
        # Calculate convergence metrics
        avg_quality = sum(self.convergence_history) / len(self.convergence_history) if self.convergence_history else 0.0
        avg_innovation = sum(self.innovation_history) / len(self.innovation_history) if self.innovation_history else 0.0
        
        return {
            "total_updates": self.total_updates,
            "successful_updates": self.successful_updates,
            "success_rate": success_rate,
            "average_quality_score": avg_quality,
            "average_innovation": avg_innovation,
            "convergence_history_size": len(self.convergence_history),
            "innovation_history_size": len(self.innovation_history),
            "magnetic_map_loaded": self.magnetic_map is not None,
            "is_initialized": self.is_initialized
        }
    
    def reset(self, initial_position: LatLon, initial_velocity: Optional[Tuple[float, float]] = None):
        """Reset the position estimator.
        
        Args:
            initial_position: New initial position
            initial_velocity: New initial velocity (dlat, dlon) in degrees/second
        """
        logger.info(f"Resetting position estimator to {initial_position}")
        
        # Clear statistics
        self.total_updates = 0
        self.successful_updates = 0
        self.convergence_history.clear()
        self.innovation_history.clear()
        
        # Reinitialize
        self.initialize(initial_position, initial_velocity)
    
    def get_current_estimate(self) -> Optional[EstimationResult]:
        """Get current position estimate without updating.
        
        Returns:
            Current estimation result or None if not initialized
        """
        if not self.is_initialized or not self.ekf:
            return None
        
        return self._create_estimation_result()
    
    def predict_position(self, dt: float) -> Optional[LatLon]:
        """Predict position after time dt without updating the filter.
        
        Args:
            dt: Time step in seconds
            
        Returns:
            Predicted position or None if not initialized
        """
        if not self.is_initialized or not self.ekf:
            return None
        
        # Get current state
        current_state = self.ekf.state.copy()
        
        # Simple prediction using current velocity
        predicted_lat = current_state[0] + current_state[2] * dt
        predicted_lon = current_state[1] + current_state[3] * dt
        
        return LatLon(lat=predicted_lat, lon=predicted_lon)