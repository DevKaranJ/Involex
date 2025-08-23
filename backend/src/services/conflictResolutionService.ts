import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { TimeEntry } from '../types/practiceManagement';

export interface ConflictResolutionRule {
  field: string;
  strategy: 'source_wins' | 'target_wins' | 'latest_wins' | 'manual_review' | 'merge';
  priority: number;
}

export interface ConflictData {
  id: string;
  billingEntryId: string;
  platform: string;
  field: string;
  sourceValue: any;
  targetValue: any;
  conflictType: 'data_mismatch' | 'duplicate_entry' | 'missing_reference' | 'validation_error';
  detectedAt: Date;
  status: 'pending' | 'resolved' | 'ignored';
  resolutionStrategy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface ConflictResolutionResult {
  resolved: boolean;
  strategy: string;
  finalValue: any;
  requiresManualReview: boolean;
  conflictId?: string;
}

export class ConflictResolutionService {
  private prisma: PrismaClient;
  private defaultRules: ConflictResolutionRule[];

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.defaultRules = [
      // Time-based fields prefer latest values
      { field: 'timeSpent', strategy: 'latest_wins', priority: 1 },
      { field: 'description', strategy: 'latest_wins', priority: 1 },
      { field: 'hourlyRate', strategy: 'source_wins', priority: 2 },
      
      // Reference fields require manual review for safety
      { field: 'client', strategy: 'manual_review', priority: 3 },
      { field: 'matter', strategy: 'manual_review', priority: 3 },
      
      // ID fields always prefer source
      { field: 'id', strategy: 'source_wins', priority: 0 },
      { field: 'externalId', strategy: 'target_wins', priority: 0 }
    ];
  }

  /**
   * Detect conflicts between local billing entry and remote time entry
   */
  async detectConflicts(
    billingEntry: any,
    remoteTimeEntry: TimeEntry,
    platform: string
  ): Promise<ConflictData[]> {
    const conflicts: ConflictData[] = [];

    try {
      // Check for data mismatches
      const fieldMappings = {
        timeSpent: 'hours',
        description: 'description',
        client: 'clientId',
        matter: 'matterId'
      };

      for (const [localField, remoteField] of Object.entries(fieldMappings)) {
        const localValue = billingEntry[localField];
        const remoteValue = remoteTimeEntry[remoteField as keyof TimeEntry];

        if (this.valuesConflict(localValue, remoteValue)) {
          conflicts.push({
            id: this.generateConflictId(),
            billingEntryId: billingEntry.id,
            platform,
            field: localField,
            sourceValue: localValue,
            targetValue: remoteValue,
            conflictType: 'data_mismatch',
            detectedAt: new Date(),
            status: 'pending'
          });
        }
      }

      // Check for duplicate entries (same time, client, description)
      const duplicateCheck = await this.checkForDuplicates(billingEntry, platform);
      if (duplicateCheck.length > 0) {
        conflicts.push({
          id: this.generateConflictId(),
          billingEntryId: billingEntry.id,
          platform,
          field: 'duplicate_entry',
          sourceValue: billingEntry,
          targetValue: duplicateCheck,
          conflictType: 'duplicate_entry',
          detectedAt: new Date(),
          status: 'pending'
        });
      }

      // Store conflicts in database if any found
      if (conflicts.length > 0) {
        await this.storeConflicts(conflicts);
        logger.warn(`Detected ${conflicts.length} conflicts for billing entry ${billingEntry.id} on platform ${platform}`);
      }

      return conflicts;
    } catch (error) {
      logger.error('Error detecting conflicts:', error);
      return [];
    }
  }

  /**
   * Resolve a conflict based on configured rules
   */
  async resolveConflict(
    conflict: ConflictData,
    customRules?: ConflictResolutionRule[]
  ): Promise<ConflictResolutionResult> {
    try {
      const rules = customRules || this.defaultRules;
      const applicableRule = rules
        .filter(rule => rule.field === conflict.field || rule.field === '*')
        .sort((a, b) => a.priority - b.priority)[0];

      if (!applicableRule) {
        return {
          resolved: false,
          strategy: 'no_rule_found',
          finalValue: conflict.sourceValue,
          requiresManualReview: true,
          conflictId: conflict.id
        };
      }

      let finalValue: any;
      let requiresManualReview = false;

      switch (applicableRule.strategy) {
        case 'source_wins':
          finalValue = conflict.sourceValue;
          break;

        case 'target_wins':
          finalValue = conflict.targetValue;
          break;

        case 'latest_wins':
          finalValue = await this.resolveByLatestTimestamp(conflict);
          break;

        case 'merge':
          finalValue = await this.mergeValues(conflict);
          break;

        case 'manual_review':
        default:
          finalValue = conflict.sourceValue;
          requiresManualReview = true;
          break;
      }

      // Update conflict record
      await this.updateConflictStatus(conflict.id, {
        status: requiresManualReview ? 'pending' : 'resolved',
        resolutionStrategy: applicableRule.strategy,
        resolvedAt: requiresManualReview ? undefined : new Date()
      });

      return {
        resolved: !requiresManualReview,
        strategy: applicableRule.strategy,
        finalValue,
        requiresManualReview,
        conflictId: conflict.id
      };
    } catch (error) {
      logger.error('Error resolving conflict:', error);
      return {
        resolved: false,
        strategy: 'error',
        finalValue: conflict.sourceValue,
        requiresManualReview: true,
        conflictId: conflict.id
      };
    }
  }

  /**
   * Resolve conflicts for a billing entry and return the resolved data
   */
  async resolveEntryConflicts(
    billingEntryId: string,
    conflicts: ConflictData[],
    customRules?: ConflictResolutionRule[]
  ): Promise<{ resolvedData: any; manualReviewRequired: boolean; pendingConflicts: ConflictData[] }> {
    const billingEntry = await this.prisma.billingEntry.findUnique({
      where: { id: billingEntryId }
    });

    if (!billingEntry) {
      throw new Error('Billing entry not found');
    }

    let resolvedData = { ...billingEntry };
    let manualReviewRequired = false;
    const pendingConflicts: ConflictData[] = [];

    for (const conflict of conflicts) {
      const resolution = await this.resolveConflict(conflict, customRules);
      
      if (resolution.resolved) {
        (resolvedData as any)[conflict.field] = resolution.finalValue;
      } else {
        manualReviewRequired = true;
        pendingConflicts.push(conflict);
      }
    }

    return {
      resolvedData,
      manualReviewRequired,
      pendingConflicts
    };
  }

  /**
   * Get pending conflicts for a user or billing entry
   */
  async getPendingConflicts(filters: {
    userId?: string;
    billingEntryId?: string;
    platform?: string;
    conflictType?: string;
  }): Promise<ConflictData[]> {
    try {
      // In a real implementation, these would be stored in a database table
      // For now, return empty array as conflicts are handled in memory
      return [];
    } catch (error) {
      logger.error('Error getting pending conflicts:', error);
      return [];
    }
  }

  /**
   * Manually resolve a conflict
   */
  async manuallyResolveConflict(
    conflictId: string,
    resolution: {
      finalValue: any;
      strategy: string;
      resolvedBy: string;
    }
  ): Promise<void> {
    try {
      await this.updateConflictStatus(conflictId, {
        status: 'resolved',
        resolutionStrategy: resolution.strategy,
        resolvedAt: new Date(),
        resolvedBy: resolution.resolvedBy
      });

      logger.info(`Conflict ${conflictId} manually resolved by ${resolution.resolvedBy}`);
    } catch (error) {
      logger.error('Error manually resolving conflict:', error);
      throw error;
    }
  }

  /**
   * Check if two values are in conflict
   */
  private valuesConflict(value1: any, value2: any): boolean {
    // Handle null/undefined
    if (value1 == null && value2 == null) return false;
    if (value1 == null || value2 == null) return true;

    // Handle numbers with tolerance
    if (typeof value1 === 'number' && typeof value2 === 'number') {
      return Math.abs(value1 - value2) > 0.01; // 1 minute tolerance for hours
    }

    // Handle strings (case-insensitive, trimmed)
    if (typeof value1 === 'string' && typeof value2 === 'string') {
      return value1.toLowerCase().trim() !== value2.toLowerCase().trim();
    }

    // Handle dates
    if (value1 instanceof Date && value2 instanceof Date) {
      return value1.getTime() !== value2.getTime();
    }

    // Default comparison
    return value1 !== value2;
  }

  /**
   * Check for duplicate entries in the practice management system
   */
  private async checkForDuplicates(
    billingEntry: any,
    platform: string
  ): Promise<any[]> {
    try {
      // Check for existing entries with same client, date, and similar description
      const existingEntries = await this.prisma.billingEntry.findMany({
        where: {
          platform,
          client: billingEntry.client,
          workDate: billingEntry.workDate,
          syncStatus: 'synced',
          NOT: { id: billingEntry.id }
        }
      });

      // Filter by similar descriptions
      return existingEntries.filter((entry: any) => 
        this.calculateStringSimilarity(entry.description, billingEntry.description) > 0.8
      );
    } catch (error) {
      logger.error('Error checking for duplicates:', error);
      return [];
    }
  }

  /**
   * Calculate string similarity (Jaccard similarity)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const set1 = new Set(str1.toLowerCase().split(/\s+/));
    const set2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Resolve conflict by latest timestamp
   */
  private async resolveByLatestTimestamp(conflict: ConflictData): Promise<any> {
    // Get the billing entry's last update time
    const billingEntry = await this.prisma.billingEntry.findUnique({
      where: { id: conflict.billingEntryId },
      select: { updatedAt: true }
    });

    if (!billingEntry) {
      return conflict.sourceValue;
    }

    // For this implementation, assume source is more recent if no other info available
    // In a real system, you'd compare timestamps from both systems
    return conflict.sourceValue;
  }

  /**
   * Merge conflicting values intelligently
   */
  private async mergeValues(conflict: ConflictData): Promise<any> {
    const { field, sourceValue, targetValue } = conflict;

    switch (field) {
      case 'description':
        // Merge descriptions by combining unique parts
        if (typeof sourceValue === 'string' && typeof targetValue === 'string') {
          const sourceWords = new Set(sourceValue.toLowerCase().split(/\s+/));
          const targetWords = new Set(targetValue.toLowerCase().split(/\s+/));
          const allWords = [...new Set([...sourceWords, ...targetWords])];
          return allWords.join(' ');
        }
        break;

      case 'timeSpent':
        // For time, use the larger value (assuming more complete tracking)
        if (typeof sourceValue === 'number' && typeof targetValue === 'number') {
          return Math.max(sourceValue, targetValue);
        }
        break;

      default:
        return sourceValue;
    }

    return sourceValue;
  }

  /**
   * Store conflicts in a tracking system (simplified for this implementation)
   */
  private async storeConflicts(conflicts: ConflictData[]): Promise<void> {
    // In a real implementation, you would store these in a database table
    // For now, we'll just log them
    for (const conflict of conflicts) {
      logger.warn(`Conflict stored: ${JSON.stringify(conflict)}`);
    }
  }

  /**
   * Update conflict status
   */
  private async updateConflictStatus(
    conflictId: string,
    updates: Partial<ConflictData>
  ): Promise<void> {
    // In a real implementation, update the conflicts table
    logger.info(`Conflict ${conflictId} status updated:`, updates);
  }

  /**
   * Generate unique conflict ID
   */
  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get conflict resolution statistics
   */
  async getConflictStats(timeframe: { start: Date; end: Date }): Promise<{
    totalConflicts: number;
    resolvedConflicts: number;
    pendingConflicts: number;
    conflictsByType: Record<string, number>;
    resolutionsByStrategy: Record<string, number>;
  }> {
    // In a real implementation, query the conflicts table
    return {
      totalConflicts: 0,
      resolvedConflicts: 0,
      pendingConflicts: 0,
      conflictsByType: {},
      resolutionsByStrategy: {}
    };
  }
}
