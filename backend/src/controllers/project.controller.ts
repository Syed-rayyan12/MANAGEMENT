import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get Logo Design projects
 * GET /api/projects/logo-design
 */
export const getLogoDesignProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    
    // Build filter based on user role
    let whereClause: any = {};
    
    if (user?.role === 'PM') {
      // PM can only see their own projects
      whereClause.pmId = user.id;
    } else if (user?.role === 'TL' || user?.role === 'PRODUCTION') {
      // TL and Production see projects they're assigned to
      whereClause.developerId = user.id;
    }
    // Executive sees all projects (no filter)
    
    const projects = await prisma.logoDesignProject.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      message: 'Logo design projects retrieved successfully',
      data: { projects },
    });
  } catch (error) {
    console.error('Get logo design projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Get Web Design projects
 * GET /api/projects/web-design
 */
export const getWebDesignProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    
    let whereClause: any = {};
    
    if (user?.role === 'PM') {
      whereClause.pmId = user.id;
    } else if (user?.role === 'TL' || user?.role === 'PRODUCTION') {
      whereClause.developerId = user.id;
    }
    
    const projects = await prisma.webDesignProject.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      message: 'Web design projects retrieved successfully',
      data: { projects },
    });
  } catch (error) {
    console.error('Get web design projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Get Web Development projects
 * GET /api/projects/web-development
 */
export const getWebDevelopmentProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    
    let whereClause: any = {};
    
    if (user?.role === 'PM') {
      whereClause.pmId = user.id;
    } else if (user?.role === 'TL' || user?.role === 'PRODUCTION') {
      whereClause.developerId = user.id;
    }
    
    const projects = await prisma.webDevelopmentProject.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      message: 'Web development projects retrieved successfully',
      data: { projects },
    });
  } catch (error) {
    console.error('Get web development projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Get Content Writer projects
 * GET /api/projects/content-writer
 */
export const getContentWriterProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    
    let whereClause: any = {};
    
    if (user?.role === 'PM') {
      whereClause.pmId = user.id;
    } else if (user?.role === 'TL' || user?.role === 'PRODUCTION') {
      whereClause.developerId = user.id;
    }
    
    const projects = await prisma.contentWriterProject.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      message: 'Content writer projects retrieved successfully',
      data: { projects },
    });
  } catch (error) {
    console.error('Get content writer projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Create new project
 * POST /api/projects
 */
export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, workspace, description, priority, dueDate, pmId, developerId, image } = req.body;

    // Use authenticated user's ID as PM if not provided
    const projectPmId = pmId || req.user?.id;

    // Validate required fields
    if (!name || !workspace || !projectPmId) {
      res.status(400).json({
        success: false,
        message: 'Name, workspace, and PM ID are required',
      });
      return;
    }

    // Validate workspace type
    const validWorkspaces = ['LOGO', 'WEB_DESIGN', 'WEB_DEVELOPMENT', 'CONTENT'];
    if (!validWorkspaces.includes(workspace)) {
      res.status(400).json({
        success: false,
        message: 'Invalid workspace type. Must be one of: LOGO, WEB_DESIGN, WEB_DEVELOPMENT, CONTENT',
      });
      return;
    }

    // Verify PM exists and has PM role
    const pm = await prisma.user.findUnique({
      where: { id: projectPmId },
    });

    if (!pm) {
      res.status(404).json({
        success: false,
        message: 'Project Manager not found',
      });
      return;
    }

    if (pm.role !== 'PM') {
      res.status(403).json({
        success: false,
        message: 'Only users with PM role can be assigned as Project Managers',
      });
      return;
    }

    // Verify developer exists if provided
    if (developerId) {
      const developer = await prisma.user.findUnique({
        where: { id: developerId },
      });

      if (!developer) {
        res.status(404).json({
          success: false,
          message: 'Developer not found',
        });
        return;
      }
    }

    const projectData = {
      name,
      description,
      priority: priority || 'MEDIUM',
      dueDate: dueDate ? new Date(dueDate) : null,
      pmId: projectPmId,
      developerId: developerId || null,
      image: image || null,
    };

    let project;

    // Create project in the appropriate workspace table
    switch (workspace) {
      case 'LOGO':
        project = await prisma.logoDesignProject.create({
          data: projectData,
        });
        break;
      case 'WEB_DESIGN':
        project = await prisma.webDesignProject.create({
          data: projectData,
        });
        break;
      case 'WEB_DEVELOPMENT':
        project = await prisma.webDevelopmentProject.create({
          data: projectData,
        });
        break;
      case 'CONTENT':
        project = await prisma.contentWriterProject.create({
          data: projectData,
        });
        break;
      default:
        res.status(400).json({
          success: false,
          message: 'Invalid workspace type',
        });
        return;
    }

    res.status(201).json({
      success: true,
      message: `Project created successfully in ${workspace} workspace`,
      data: { project },
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Get all projects (from all workspaces)
 * GET /api/projects
 */
export const getAllProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    
    // Build filter based on user role
    let whereClause: any = {};
    
    if (user?.role === 'PM') {
      // PM can only see their own projects
      whereClause.pmId = user.id;
    } else if (user?.role === 'TL' || user?.role === 'PRODUCTION') {
      // TL and Production see projects they're assigned to
      whereClause.developerId = user.id;
    }
    // Executive sees all projects (no filter)
    
    const [logoProjects, webDesignProjects, webDevProjects, contentProjects] = await Promise.all([
      prisma.logoDesignProject.findMany({ where: whereClause, orderBy: { createdAt: 'desc' } }),
      prisma.webDesignProject.findMany({ where: whereClause, orderBy: { createdAt: 'desc' } }),
      prisma.webDevelopmentProject.findMany({ where: whereClause, orderBy: { createdAt: 'desc' } }),
      prisma.contentWriterProject.findMany({ where: whereClause, orderBy: { createdAt: 'desc' } }),
    ]);

    const allProjects = [
      ...logoProjects.map(p => ({ ...p, workspace: 'LOGO' })),
      ...webDesignProjects.map(p => ({ ...p, workspace: 'WEB_DESIGN' })),
      ...webDevProjects.map(p => ({ ...p, workspace: 'WEB_DEVELOPMENT' })),
      ...contentProjects.map(p => ({ ...p, workspace: 'CONTENT' })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.status(200).json({
      success: true,
      message: 'All projects retrieved successfully',
      data: { projects: allProjects },
    });
  } catch (error) {
    console.error('Get all projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Get project by ID (searches all workspace tables)
 * GET /api/projects/:id
 */
export const getProjectById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Search in all workspace tables
    const [logoProject, webDesignProject, webDevProject, contentProject] = await Promise.all([
      prisma.logoDesignProject.findUnique({ where: { id } }),
      prisma.webDesignProject.findUnique({ where: { id } }),
      prisma.webDevelopmentProject.findUnique({ where: { id } }),
      prisma.contentWriterProject.findUnique({ where: { id } }),
    ]);

    const project = logoProject || webDesignProject || webDevProject || contentProject;

    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
      });
      return;
    }

    // Add workspace type to response
    let workspace = 'LOGO';
    if (webDesignProject) workspace = 'WEB_DESIGN';
    else if (webDevProject) workspace = 'WEB_DEVELOPMENT';
    else if (contentProject) workspace = 'CONTENT';

    res.status(200).json({
      success: true,
      message: 'Project retrieved successfully',
      data: { project: { ...project, workspace } },
    });
  } catch (error) {
    console.error('Get project by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Update project
 * PUT /api/projects/:id
 */
export const updateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { workspace, ...updateData } = req.body;

    // Search for project in all tables
    const [logoProject, webDesignProject, webDevProject, contentProject] = await Promise.all([
      prisma.logoDesignProject.findUnique({ where: { id } }),
      prisma.webDesignProject.findUnique({ where: { id } }),
      prisma.webDevelopmentProject.findUnique({ where: { id } }),
      prisma.contentWriterProject.findUnique({ where: { id } }),
    ]);

    const existingProject = logoProject || webDesignProject || webDevProject || contentProject;

    if (!existingProject) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
      });
      return;
    }

    // Validate status if being updated
    if (updateData.status) {
      const validStatuses = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'REVISIONS'];
      if (!validStatuses.includes(updateData.status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status. Must be one of: TODO, IN_PROGRESS, COMPLETED, REVISIONS',
        });
        return;
      }
    }

    // Validate priority if being updated
    if (updateData.priority) {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      if (!validPriorities.includes(updateData.priority)) {
        res.status(400).json({
          success: false,
          message: 'Invalid priority. Must be one of: LOW, MEDIUM, HIGH, CRITICAL',
        });
        return;
      }
    }

    // Verify PM exists and has PM role if being updated
    if (updateData.pmId) {
      const pm = await prisma.user.findUnique({
        where: { id: updateData.pmId },
      });

      if (!pm) {
        res.status(404).json({
          success: false,
          message: 'Project Manager not found',
        });
        return;
      }

      if (pm.role !== 'PM') {
        res.status(403).json({
          success: false,
          message: 'Only users with PM role can be assigned as Project Managers',
        });
        return;
      }
    }

    // Verify developer exists if being updated
    if (updateData.developerId) {
      const developer = await prisma.user.findUnique({
        where: { id: updateData.developerId },
      });

      if (!developer) {
        res.status(404).json({
          success: false,
          message: 'Developer not found',
        });
        return;
      }
    }

    const finalUpdateData = {
      ...updateData,
      dueDate: updateData.dueDate ? new Date(updateData.dueDate) : undefined,
    };

    let project;

    // Update in the correct table
    if (logoProject) {
      project = await prisma.logoDesignProject.update({
        where: { id },
        data: finalUpdateData,
      });
    } else if (webDesignProject) {
      project = await prisma.webDesignProject.update({
        where: { id },
        data: finalUpdateData,
      });
    } else if (webDevProject) {
      project = await prisma.webDevelopmentProject.update({
        where: { id },
        data: finalUpdateData,
      });
    } else if (contentProject) {
      project = await prisma.contentWriterProject.update({
        where: { id },
        data: finalUpdateData,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: { project },
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Delete project
 * DELETE /api/projects/:id
 */
export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Search for project in all tables
    const [logoProject, webDesignProject, webDevProject, contentProject] = await Promise.all([
      prisma.logoDesignProject.findUnique({ where: { id } }),
      prisma.webDesignProject.findUnique({ where: { id } }),
      prisma.webDevelopmentProject.findUnique({ where: { id } }),
      prisma.contentWriterProject.findUnique({ where: { id } }),
    ]);

    const existingProject = logoProject || webDesignProject || webDevProject || contentProject;

    if (!existingProject) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
      });
      return;
    }

    // Delete from the correct table
    if (logoProject) {
      await prisma.logoDesignProject.delete({ where: { id } });
    } else if (webDesignProject) {
      await prisma.webDesignProject.delete({ where: { id } });
    } else if (webDevProject) {
      await prisma.webDevelopmentProject.delete({ where: { id } });
    } else if (contentProject) {
      await prisma.contentWriterProject.delete({ where: { id } });
    }

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
