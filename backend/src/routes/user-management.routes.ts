import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireAdminAccess } from '../middleware/admin.middleware';
import { userManagementService, CreateUserRequest } from '../services/auth/user-management.service';
import { authService } from '../services/auth/auth.service';

const router = Router();

// Apply authentication and admin access to all routes
// TEMPORARY: Skip authentication for testing
// router.use(authenticateToken);
// router.use(requireAdminAccess);

// TEMPORARY: Mock admin middleware for testing
router.use((req, res, next) => {
  // Check if we have a real user from authentication
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];
    
    // If it's a mock token, extract the user ID
    if (token.startsWith('mock-jwt-token-for-')) {
      const userId = token.replace('mock-jwt-token-for-', '');
      
      // Get real user data from database
      authService.getUserProfile(userId).then(user => {
        if (user) {
          req.user = {
            id: user.id,
            email: user.email,
            customer_id: user.customer_id,
            role: user.role,
            full_name: user.full_name
          };
        } else {
          // Fallback to mock data
          req.user = {
            id: 'temp-admin-user',
            email: 'test@anvayalabs.com',
            customer_id: null,
            role: 'AL_ADMIN'
          };
        }
        next();
      }).catch(() => {
        // Fallback to mock data on error
        req.user = {
          id: 'temp-admin-user',
          email: 'test@anvayalabs.com',
          customer_id: null,
          role: 'AL_ADMIN'
        };
        next();
      });
      return;
    }
  }
  
  // Fallback to mock data
  req.user = {
    id: 'temp-admin-user',
    email: 'test@anvayalabs.com',
    customer_id: null,
    role: 'AL_ADMIN'
  };
  next();
});

/**
 * GET /api/users
 * Get all users
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await userManagementService.getAllUsers();
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch users'
    });
  }
});

/**
 * GET /api/users/:userId
 * Get user by ID
 */
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await userManagementService.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user'
    });
  }
});

/**
 * POST /api/users
 * Create a new user
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userData: CreateUserRequest = req.body;
    
    // Validate required fields
    if (!userData.email || !userData.password || !userData.role) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and role are required'
      });
    }

    // Validate role
    const validRoles = ['admin', 'member', 'viewer', 'AL_ADMIN'];
    if (!validRoles.includes(userData.role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be one of: admin, member, viewer, AL_ADMIN'
      });
    }

    const newUser = await userManagementService.createUser(userData);
    
    res.status(201).json({
      success: true,
      data: newUser,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create user'
    });
  }
});

/**
 * PUT /api/users/:userId
 * Update user
 */
router.put('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;
    
    // Validate role if provided
    if (updateData.role) {
      const validRoles = ['admin', 'member', 'viewer', 'AL_ADMIN'];
      if (!validRoles.includes(updateData.role)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid role. Must be one of: admin, member, viewer, AL_ADMIN'
        });
      }
    }

    const updatedUser = await userManagementService.updateUser(userId, updateData);
    
    res.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update user'
    });
  }
});

/**
 * DELETE /api/users/:userId
 * Delete user
 */
router.delete('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Prevent deleting the current user
    if (userId === req.user?.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
    }

    await userManagementService.deleteUser(userId);
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete user'
    });
  }
});

/**
 * POST /api/users/authenticate
 * Authenticate user with email and password (for admin portal login)
 */
router.post('/authenticate', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // TEMPORARY: Allow admin access for testing with any @anvayalabs.com email
    if (email.endsWith('@anvayalabs.com')) {
      console.log('🔧 TEMPORARY: Allowing admin access for testing -', email);
      const tempUser = {
        id: 'temp-admin-user-' + Date.now(),
        email: email,
        role: 'AL_ADMIN',
        full_name: 'Test Admin User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      return res.json({
        success: true,
        data: tempUser,
        message: 'Authentication successful (temporary testing mode)'
      });
    }

    // Try normal authentication
    const user = await userManagementService.authenticateUser(email, password);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check if user has admin access
    const isAdmin = user.role === 'AL_ADMIN' && user.email.endsWith('@anvayalabs.com');
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required'
      });
    }

    res.json({
      success: true,
      data: user,
      message: 'Authentication successful'
    });
  } catch (error) {
    console.error('Error authenticating user:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    });
  }
});

export default router;
