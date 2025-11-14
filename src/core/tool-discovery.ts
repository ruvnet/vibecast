/**
 * Tool Discovery System
 * Discovers and loads tool descriptors from the /tools/ directory
 */

import fs from 'fs/promises';
import path from 'path';
import { ToolDescriptor, ToolDescriptorSchema } from '../types/protocol.js';

export class ToolDiscovery {
  private tools: Map<string, ToolDescriptor> = new Map();
  private toolsDirectory: string;

  constructor(toolsDirectory: string) {
    this.toolsDirectory = toolsDirectory;
  }

  /**
   * Discover all tools in the tools directory
   */
  async discoverTools(): Promise<void> {
    try {
      // Ensure tools directory exists
      await fs.mkdir(this.toolsDirectory, { recursive: true });

      // Read all files in the tools directory
      const files = await fs.readdir(this.toolsDirectory);
      const jsonFiles = files.filter((file) => file.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.toolsDirectory, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const toolData = JSON.parse(content);

          // Validate tool descriptor against schema
          const tool = ToolDescriptorSchema.parse(toolData);
          this.tools.set(tool.id, tool);

          console.log(`[Tool Discovery] Loaded tool: ${tool.name} (${tool.id})`);
        } catch (error) {
          console.error(`[Tool Discovery] Failed to load tool from ${file}:`, error);
        }
      }

      console.log(`[Tool Discovery] Discovered ${this.tools.size} tools`);
    } catch (error) {
      console.error('[Tool Discovery] Failed to discover tools:', error);
      throw error;
    }
  }

  /**
   * Get a specific tool by ID
   */
  getTool(toolId: string): ToolDescriptor | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get all discovered tools
   */
  getAllTools(): ToolDescriptor[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if a tool exists
   */
  hasTool(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  /**
   * Reload tools from disk
   */
  async reload(): Promise<void> {
    this.tools.clear();
    await this.discoverTools();
  }

  /**
   * Get tools by tag
   */
  getToolsByTag(tag: string): ToolDescriptor[] {
    return Array.from(this.tools.values()).filter((tool) =>
      tool.metadata?.tags?.includes(tag)
    );
  }

  /**
   * Search tools by keyword in name or description
   */
  searchTools(keyword: string): ToolDescriptor[] {
    const lowerKeyword = keyword.toLowerCase();
    return Array.from(this.tools.values()).filter(
      (tool) =>
        tool.name.toLowerCase().includes(lowerKeyword) ||
        tool.description.toLowerCase().includes(lowerKeyword)
    );
  }
}
