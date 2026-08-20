import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { IOrgUnitClosure } from '../interfaces/org-unit.interface';

@Injectable()
export class OrgUnitClosureRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * §6.1 Insert a node into the transitive closure tree.
   * Copies all ancestor links from the parent node with depth incremented by 1,
   * and writes the self-row at depth 0.
   *
   * @param newId The newly inserted org unit ID
   * @param parentId The parent org unit ID (NULL for root nodes)
   * @param qr Optional QueryRunner for transactional atomicity
   */
  async insertNodeClosure(
    newId: string,
    parentId: string | null,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      INSERT INTO org.OrgUnitClosure (AncestorOrgUnitId, DescendantOrgUnitId, Depth)
      SELECT c.AncestorOrgUnitId, @0, c.Depth + 1
      FROM   org.OrgUnitClosure c
      WHERE  c.DescendantOrgUnitId = @1
      UNION ALL
      SELECT @0, @0, 0;
    `;
    await this.getExecutor(qr).query(sql, [newId, parentId]);
  }

  /**
   * §6.2 Step 1: Detach a moving subtree from its old ancestors.
   * Removes links from all nodes in the subtree to ancestors above the subtree root,
   * while strictly preserving links that are internal to the subtree itself.
   *
   * @param nodeId The root node of the moving subtree
   * @param qr Optional QueryRunner for transactional atomicity
   */
  async detachSubtree(nodeId: string, qr?: QueryRunner): Promise<void> {
    const sql = `
      DELETE cl
      FROM org.OrgUnitClosure AS cl
      INNER JOIN org.OrgUnitClosure AS sub
              ON cl.DescendantOrgUnitId = sub.DescendantOrgUnitId
      LEFT JOIN org.OrgUnitClosure AS internal
              ON internal.AncestorOrgUnitId   = sub.AncestorOrgUnitId
             AND internal.DescendantOrgUnitId = cl.AncestorOrgUnitId
      WHERE sub.AncestorOrgUnitId = @0
        AND internal.AncestorOrgUnitId IS NULL;
    `;
    await this.getExecutor(qr).query(sql, [nodeId]);
  }

  /**
   * §6.2 Step 2: Attach a subtree beneath a new parent node.
   * Connects all ancestors of the new parent to every node in the moving subtree,
   * calculating the new combined transitive depth.
   *
   * @param nodeId The root node of the moving subtree
   * @param newParentId The target new parent node ID
   * @param qr Optional QueryRunner for transactional atomicity
   */
  async attachSubtree(
    nodeId: string,
    newParentId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      INSERT INTO org.OrgUnitClosure (AncestorOrgUnitId, DescendantOrgUnitId, Depth)
      SELECT sup.AncestorOrgUnitId,
             sub.DescendantOrgUnitId,
             sup.Depth + sub.Depth + 1
      FROM org.OrgUnitClosure AS sup
      CROSS JOIN org.OrgUnitClosure AS sub
      WHERE sup.DescendantOrgUnitId = @1
        AND sub.AncestorOrgUnitId   = @0;
    `;
    await this.getExecutor(qr).query(sql, [nodeId, newParentId]);
  }

  /**
   * Retrieves all descendant org unit IDs for a given node (including itself),
   * ordered from shallowest to deepest.
   *
   * @param nodeId The ancestor org unit ID
   * @param qr Optional QueryRunner
   */
  async getDescendantIds(nodeId: string, qr?: QueryRunner): Promise<string[]> {
    const sql = `
      SELECT DescendantOrgUnitId AS id
      FROM org.OrgUnitClosure
      WHERE AncestorOrgUnitId = @0
      ORDER BY Depth ASC;
    `;
    const rows = await this.getExecutor(qr).query(sql, [nodeId]);
    return rows.map((r: { id: string }) => r.id);
  }

  /**
   * Retrieves all ancestor org unit IDs for a given node (from root down to self),
   * ordered from root (greatest depth) to direct parent to self.
   *
   * @param nodeId The descendant org unit ID
   * @param qr Optional QueryRunner
   */
  async getAncestorIds(nodeId: string, qr?: QueryRunner): Promise<string[]> {
    const sql = `
      SELECT AncestorOrgUnitId AS id
      FROM org.OrgUnitClosure
      WHERE DescendantOrgUnitId = @0
      ORDER BY Depth DESC;
    `;
    const rows = await this.getExecutor(qr).query(sql, [nodeId]);
    return rows.map((r: { id: string }) => r.id);
  }

  /**
   * §7.2 Rule M3 (Cycle Check): Checks whether candidateId is a descendant of nodeId.
   * Prevents reparenting a node under any of its own descendants.
   *
   * @param candidateId The prospective new parent ID
   * @param nodeId The node being moved
   * @param qr Optional QueryRunner
   * @returns true if candidateId is a descendant of nodeId (cycle exists)
   */
  async isDescendantOf(
    candidateId: string,
    nodeId: string,
    qr?: QueryRunner,
  ): Promise<boolean> {
    const sql = `
      SELECT 1 AS found
      FROM org.OrgUnitClosure
      WHERE AncestorOrgUnitId = @0 AND DescendantOrgUnitId = @1;
    `;
    const rows = await this.getExecutor(qr).query(sql, [nodeId, candidateId]);
    return rows.length > 0;
  }

  /**
   * Retrieves closure relationships where ancestor equals the given ID.
   */
  async getAncestors(
    orgUnitId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnitClosure[]> {
    const sql = `
      SELECT AncestorOrgUnitId AS ancestorOrgUnitId,
             DescendantOrgUnitId AS descendantOrgUnitId,
             Depth AS depth
      FROM org.OrgUnitClosure
      WHERE DescendantOrgUnitId = @0
      ORDER BY Depth DESC;
    `;
    return this.getExecutor(qr).query(sql, [orgUnitId]);
  }

  /**
   * Retrieves closure relationships where descendant equals the given ID.
   */
  async getDescendants(
    orgUnitId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnitClosure[]> {
    const sql = `
      SELECT AncestorOrgUnitId AS ancestorOrgUnitId,
             DescendantOrgUnitId AS descendantOrgUnitId,
             Depth AS depth
      FROM org.OrgUnitClosure
      WHERE AncestorOrgUnitId = @0
      ORDER BY Depth ASC;
    `;
    return this.getExecutor(qr).query(sql, [orgUnitId]);
  }

  /**
   * §6.3 Integrity Check Query
   * Runs verification checks across the closure tree and adjacency list:
   *  A. Every live node has a self-row at depth 0
   *  B. Closure agrees with adjacency for direct parents (depth 1)
   *  C. No orphan closure rows exist
   *  D. Stored Depth on OrgUnits matches closure depth from root
   *
   * @param qr Optional QueryRunner
   * @returns Array of detected integrity discrepancies (must be empty for healthy tree)
   */
  async runIntegrityCheck(qr?: QueryRunner): Promise<any[]> {
    const sql = `
      -- A. Every live node must have a self-row at depth 0
      SELECT u.OrgUnitId AS orgUnitId, u.Code AS code, 'MISSING_SELF_ROW' AS problem
      FROM org.OrgUnits AS u
      LEFT JOIN org.OrgUnitClosure AS c
             ON c.AncestorOrgUnitId = u.OrgUnitId
            AND c.DescendantOrgUnitId = u.OrgUnitId
            AND c.Depth = 0
      WHERE u.IsDeleted = 0 AND c.AncestorOrgUnitId IS NULL

      UNION ALL
      -- B. Closure must agree with adjacency for direct parents
      SELECT u.OrgUnitId AS orgUnitId, u.Code AS code, 'MISSING_PARENT_EDGE' AS problem
      FROM org.OrgUnits AS u
      LEFT JOIN org.OrgUnitClosure AS c
             ON c.AncestorOrgUnitId = u.ParentOrgUnitId
            AND c.DescendantOrgUnitId = u.OrgUnitId
            AND c.Depth = 1
      WHERE u.IsDeleted = 0 AND u.ParentOrgUnitId IS NOT NULL AND c.AncestorOrgUnitId IS NULL

      UNION ALL
      -- C. No orphan closure rows
      SELECT c.DescendantOrgUnitId AS orgUnitId, NULL AS code, 'ORPHAN_CLOSURE_ROW' AS problem
      FROM org.OrgUnitClosure AS c
      LEFT JOIN org.OrgUnits AS u ON u.OrgUnitId = c.DescendantOrgUnitId
      WHERE u.OrgUnitId IS NULL

      UNION ALL
      -- D. Stored Depth must match closure depth from root
      SELECT u.OrgUnitId AS orgUnitId, u.Code AS code, 'DEPTH_MISMATCH' AS problem
      FROM org.OrgUnits AS u
      INNER JOIN (
          SELECT DescendantOrgUnitId, MAX(Depth) AS MaxDepth
          FROM org.OrgUnitClosure GROUP BY DescendantOrgUnitId
      ) AS d ON d.DescendantOrgUnitId = u.OrgUnitId
      WHERE u.IsDeleted = 0 AND u.Depth <> d.MaxDepth;
    `;
    return this.getExecutor(qr).query(sql);
  }
}
