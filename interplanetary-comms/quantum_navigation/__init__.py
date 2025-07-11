"""Quantum-magnetic navigation module for interplanetary communications.

This module integrates quantum-magnetic navigation with the IPCP protocol
to provide position-aware routing for interplanetary communications.
"""

__version__ = "1.0.0"
__author__ = "Interplanetary Communications Team"

from .quantum_navigator import QuantumNavigator
from .position_estimator import PositionEstimator
from .trajectory_planner import TrajectoryPlanner
from .ipcp_integration import IPCPPositionProvider

__all__ = [
    "QuantumNavigator",
    "PositionEstimator", 
    "TrajectoryPlanner",
    "IPCPPositionProvider"
]