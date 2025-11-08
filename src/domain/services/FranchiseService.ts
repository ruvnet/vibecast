/**
 * Franchise Service - Business Logic Layer
 */

import { Franchise } from '../entities/Franchise';
import { Territory } from '../entities/Territory';
import { FranchiseAgreement } from '../entities/FranchiseAgreement';
import {
  Address,
  Coordinates,
  ContactInfo,
  PerformanceMetricType,
  PerformanceMetric,
  FranchiseStatus
} from '../types';
import { DomainEvent } from '../events/DomainEvent';

interface CreateFranchiseProps {
  name: string;
  ownerId: string;
  ownerName: string;
  ownerContact: ContactInfo;
  location: Address;
  coordinates: Coordinates;
  territory: Territory;
}

interface PerformanceReport {
  franchiseId: string;
  overallScore: number;
  metrics: PerformanceMetric[];
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendations: string[];
}

interface GrowthTrajectory {
  trend: 'increasing' | 'decreasing' | 'stable';
  averageGrowthRate: number;
  projection: number;
  confidence: number;
}

interface FranchiseDensity {
  franchisesPerCapita: number;
  marketCoverage: number;
  saturationLevel: 'low' | 'moderate' | 'high' | 'saturated';
}

interface TerritoryConflict {
  territories: string[];
  overlapPercentage: number;
  severity: 'low' | 'medium' | 'high';
}

interface ConflictResolution {
  strategy: 'adjust_boundaries' | 'merge' | 'split';
  details: string;
  estimatedImpact: string;
}

export class FranchiseService {
  /**
   * Franchise Creation
   */
  public createFranchise(props: CreateFranchiseProps): {
    franchise: Franchise;
    events: DomainEvent[];
  } {
    const { territory, coordinates } = props;

    // Validate territory availability
    if (territory.status !== 'AVAILABLE') {
      throw new Error('Territory is already allocated');
    }

    // Validate location is within territory
    if (!territory.containsPoint(coordinates)) {
      throw new Error('Franchise location must be within territory boundaries');
    }

    const events: DomainEvent[] = [];

    // Create franchise
    const franchise = new Franchise({
      name: props.name,
      ownerId: props.ownerId,
      ownerName: props.ownerName,
      ownerContact: props.ownerContact,
      location: props.location,
      coordinates: props.coordinates,
      territoryId: territory.id
    });

    // Allocate territory
    const allocationEvent = territory.allocate(franchise.id);
    events.push(allocationEvent);

    return { franchise, events };
  }

  /**
   * Franchise Onboarding
   */
  public onboardFranchise(
    franchise: Franchise,
    agreement: FranchiseAgreement,
    openingDate: Date
  ): { events: DomainEvent[] } {
    const events: DomainEvent[] = [];

    // Validate agreement is signed
    if (!agreement.signedDate) {
      throw new Error('Agreement must be signed before onboarding');
    }

    // Onboard franchise
    const onboardEvent = franchise.onboard(agreement.id, openingDate);
    events.push(onboardEvent);

    // Activate agreement
    const activateEvent = agreement.activate();
    events.push(activateEvent);

    return { events };
  }

  public completeOnboardingChecklist(
    franchise: Franchise,
    agreement: FranchiseAgreement,
    checklist: Record<string, boolean>,
    openingDate: Date
  ): { success: boolean; events: DomainEvent[] } {
    // Verify all checklist items are complete
    const allComplete = Object.values(checklist).every(item => item === true);

    if (!allComplete) {
      throw new Error('All onboarding requirements must be completed');
    }

    const result = this.onboardFranchise(franchise, agreement, openingDate);
    return { success: true, ...result };
  }

  /**
   * Performance Analytics
   */
  public generatePerformanceReport(franchise: Franchise): PerformanceReport {
    const overallScore = franchise.calculatePerformanceScore();
    const metrics = franchise.performanceMetrics;

    let performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (overallScore >= 90) performanceGrade = 'A';
    else if (overallScore >= 80) performanceGrade = 'B';
    else if (overallScore >= 70) performanceGrade = 'C';
    else if (overallScore >= 60) performanceGrade = 'D';
    else performanceGrade = 'F';

    const recommendations: string[] = [];

    // Analyze metrics and provide recommendations
    metrics.forEach(metric => {
      const achievementRate = (metric.value / metric.target) * 100;

      if (achievementRate < 70) {
        recommendations.push(
          `Improve ${metric.type.toLowerCase().replace('_', ' ')} - currently at ${achievementRate.toFixed(0)}% of target`
        );
      }
    });

    return {
      franchiseId: franchise.id,
      overallScore,
      metrics,
      performanceGrade,
      recommendations
    };
  }

  public calculateGrowthTrajectory(
    franchise: Franchise,
    metricType: PerformanceMetricType
  ): GrowthTrajectory {
    const metrics = franchise.getMetricsByType(metricType);

    if (metrics.length < 2) {
      return {
        trend: 'stable',
        averageGrowthRate: 0,
        projection: 0,
        confidence: 0
      };
    }

    // Sort by period
    const sortedMetrics = metrics.sort(
      (a, b) => a.period.getTime() - b.period.getTime()
    );

    // Calculate growth rates
    const growthRates: number[] = [];
    for (let i = 1; i < sortedMetrics.length; i++) {
      const previous = sortedMetrics[i - 1].value;
      const current = sortedMetrics[i].value;
      const rate = ((current - previous) / previous) * 100;
      growthRates.push(rate);
    }

    const averageGrowthRate = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (averageGrowthRate > 5) trend = 'increasing';
    else if (averageGrowthRate < -5) trend = 'decreasing';
    else trend = 'stable';

    // Simple projection (last value * growth rate)
    const lastValue = sortedMetrics[sortedMetrics.length - 1].value;
    const projection = lastValue * (1 + averageGrowthRate / 100);

    // Confidence based on consistency
    const variance = this.calculateVariance(growthRates);
    const confidence = Math.max(0, 100 - variance);

    return {
      trend,
      averageGrowthRate,
      projection,
      confidence
    };
  }

  public identifyAtRiskFranchises(franchises: Franchise[]): Franchise[] {
    const atRisk: Franchise[] = [];

    franchises.forEach(franchise => {
      if (franchise.status !== FranchiseStatus.ACTIVE) {
        return;
      }

      const score = franchise.calculatePerformanceScore();

      // Consider franchise at risk if:
      // 1. Performance score < 60
      // 2. Declining revenue trend
      // 3. Low customer satisfaction

      if (score < 60) {
        atRisk.push(franchise);
        return;
      }

      const revenueMetrics = franchise.getMetricsByType(PerformanceMetricType.REVENUE);
      if (revenueMetrics.length >= 2) {
        const trajectory = this.calculateGrowthTrajectory(franchise, PerformanceMetricType.REVENUE);
        if (trajectory.trend === 'decreasing' && trajectory.averageGrowthRate < -10) {
          atRisk.push(franchise);
        }
      }
    });

    return atRisk;
  }

  /**
   * Growth Planning
   */
  public recommendExpansionTerritories(
    territories: Territory[],
    count: number
  ): Territory[] {
    // Filter available territories
    const available = territories.filter(t => t.status === 'AVAILABLE');

    // Score and sort territories by attractiveness
    const scored = available.map(territory => ({
      territory,
      score: territory.assessAttractiveness()
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, count).map(s => s.territory);
  }

  public calculateFranchiseDensity(
    territory: Territory,
    franchiseCount: number
  ): FranchiseDensity {
    const population = territory.metadata.population || 1;
    const franchisesPerCapita = franchiseCount / population;

    const area = territory.calculateArea();
    const marketCoverage = (franchiseCount * 100) / (area / 10); // Assuming each franchise covers ~10 sq km

    let saturationLevel: 'low' | 'moderate' | 'high' | 'saturated';
    if (marketCoverage < 25) saturationLevel = 'low';
    else if (marketCoverage < 50) saturationLevel = 'moderate';
    else if (marketCoverage < 75) saturationLevel = 'high';
    else saturationLevel = 'saturated';

    return {
      franchisesPerCapita,
      marketCoverage,
      saturationLevel
    };
  }

  /**
   * Territory Conflict Resolution
   */
  public detectTerritoryConflicts(territories: Territory[]): TerritoryConflict[] {
    const conflicts: TerritoryConflict[] = [];

    for (let i = 0; i < territories.length; i++) {
      for (let j = i + 1; j < territories.length; j++) {
        const t1 = territories[i];
        const t2 = territories[j];

        if (t1.hasOverlapWith(t2)) {
          // Calculate overlap percentage (simplified)
          const overlapPercentage = this.calculateOverlapPercentage(t1, t2);

          let severity: 'low' | 'medium' | 'high';
          if (overlapPercentage < 10) severity = 'low';
          else if (overlapPercentage < 30) severity = 'medium';
          else severity = 'high';

          conflicts.push({
            territories: [t1.id, t2.id],
            overlapPercentage,
            severity
          });
        }
      }
    }

    return conflicts;
  }

  public proposeTerritoryResolution(
    territory1: Territory,
    territory2: Territory
  ): ConflictResolution {
    const overlapPercentage = this.calculateOverlapPercentage(territory1, territory2);

    if (overlapPercentage < 10) {
      return {
        strategy: 'adjust_boundaries',
        details: 'Minor boundary adjustment to eliminate small overlap',
        estimatedImpact: 'Minimal impact on both territories'
      };
    }

    if (overlapPercentage > 50) {
      // Check if one territory is much more valuable
      const score1 = territory1.assessAttractiveness();
      const score2 = territory2.assessAttractiveness();

      if (Math.abs(score1 - score2) < 20) {
        return {
          strategy: 'merge',
          details: 'Merge both territories into a single larger territory',
          estimatedImpact: 'Combined market potential with shared resources'
        };
      }
    }

    return {
      strategy: 'split',
      details: 'Divide overlapping area and reassign to each territory',
      estimatedImpact: 'Clear boundaries with equitable distribution'
    };
  }

  /**
   * Helper Methods
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

    return Math.sqrt(variance);
  }

  private calculateOverlapPercentage(territory1: Territory, territory2: Territory): number {
    // Simplified calculation for circular boundaries
    if (territory1.boundaries.type === 'circle' && territory2.boundaries.type === 'circle') {
      const center1 = territory1.boundaries.center!;
      const center2 = territory2.boundaries.center!;
      const r1 = territory1.boundaries.radius!;
      const r2 = territory2.boundaries.radius!;

      // Calculate distance between centers using Haversine
      const R = 6371; // Earth radius in km
      const dLat = (center2.latitude - center1.latitude) * Math.PI / 180;
      const dLon = (center2.longitude - center1.longitude) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(center1.latitude * Math.PI / 180) * Math.cos(center2.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      if (distance >= r1 + r2) {
        return 0; // No overlap
      }

      // Simplified overlap percentage
      const overlap = r1 + r2 - distance;
      const maxOverlap = Math.min(r1, r2) * 2;
      return Math.min(100, (overlap / maxOverlap) * 100);
    }

    return 20; // Default estimate for non-circular boundaries
  }
}
