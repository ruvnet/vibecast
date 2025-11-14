/**
 * Resource Discovery System
 * Discovers and loads resource descriptors from the /resources/ directory
 */

import fs from 'fs/promises';
import path from 'path';
import { ResourceDescriptor, ResourceDescriptorSchema } from '../types/protocol.js';

export class ResourceDiscovery {
  private resources: Map<string, ResourceDescriptor> = new Map();
  private resourcesDirectory: string;

  constructor(resourcesDirectory: string) {
    this.resourcesDirectory = resourcesDirectory;
  }

  /**
   * Discover all resources in the resources directory
   */
  async discoverResources(): Promise<void> {
    try {
      // Ensure resources directory exists
      await fs.mkdir(this.resourcesDirectory, { recursive: true });

      // Read all files in the resources directory
      const files = await fs.readdir(this.resourcesDirectory);
      const jsonFiles = files.filter((file) => file.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.resourcesDirectory, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const resourceData = JSON.parse(content);

          // Validate resource descriptor against schema
          const resource = ResourceDescriptorSchema.parse(resourceData);
          this.resources.set(resource.id, resource);

          console.log(`[Resource Discovery] Loaded resource: ${resource.name} (${resource.id})`);
        } catch (error) {
          console.error(`[Resource Discovery] Failed to load resource from ${file}:`, error);
        }
      }

      console.log(`[Resource Discovery] Discovered ${this.resources.size} resources`);
    } catch (error) {
      console.error('[Resource Discovery] Failed to discover resources:', error);
      throw error;
    }
  }

  /**
   * Get a specific resource by ID
   */
  getResource(resourceId: string): ResourceDescriptor | undefined {
    return this.resources.get(resourceId);
  }

  /**
   * Get all discovered resources
   */
  getAllResources(): ResourceDescriptor[] {
    return Array.from(this.resources.values());
  }

  /**
   * Check if a resource exists
   */
  hasResource(resourceId: string): boolean {
    return this.resources.has(resourceId);
  }

  /**
   * Reload resources from disk
   */
  async reload(): Promise<void> {
    this.resources.clear();
    await this.discoverResources();
  }

  /**
   * Get resources by tag
   */
  getResourcesByTag(tag: string): ResourceDescriptor[] {
    return Array.from(this.resources.values()).filter((resource) =>
      resource.metadata?.tags?.includes(tag)
    );
  }

  /**
   * Search resources by keyword in name or description
   */
  searchResources(keyword: string): ResourceDescriptor[] {
    const lowerKeyword = keyword.toLowerCase();
    return Array.from(this.resources.values()).filter(
      (resource) =>
        resource.name.toLowerCase().includes(lowerKeyword) ||
        resource.description.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * Get resources by MIME type
   */
  getResourcesByMimeType(mimeType: string): ResourceDescriptor[] {
    return Array.from(this.resources.values()).filter(
      (resource) => resource.mimeType === mimeType
    );
  }
}
