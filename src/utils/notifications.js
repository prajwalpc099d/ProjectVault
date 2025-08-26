import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Notification types
export const NOTIFICATION_TYPES = {
  PROJECT_SUBMITTED: 'project_submitted',
  PROJECT_APPROVED: 'project_approved',
  PROJECT_REJECTED: 'project_rejected',
  FEEDBACK_RECEIVED: 'feedback_received',
  PROJECT_UPDATED: 'project_updated',
  PROJECT_DELETED: 'project_deleted',
  ROLE_CHANGED: 'role_changed',
  WELCOME: 'welcome',
  SYSTEM_ANNOUNCEMENT: 'system_announcement'
};

// Notification icons (Material-UI icon names)
export const NOTIFICATION_ICONS = {
  [NOTIFICATION_TYPES.PROJECT_SUBMITTED]: 'AddCircle',
  [NOTIFICATION_TYPES.PROJECT_APPROVED]: 'CheckCircle',
  [NOTIFICATION_TYPES.PROJECT_REJECTED]: 'Cancel',
  [NOTIFICATION_TYPES.FEEDBACK_RECEIVED]: 'Comment',
  [NOTIFICATION_TYPES.PROJECT_UPDATED]: 'Edit',
  [NOTIFICATION_TYPES.PROJECT_DELETED]: 'Delete',
  [NOTIFICATION_TYPES.ROLE_CHANGED]: 'AdminPanelSettings',
  [NOTIFICATION_TYPES.WELCOME]: 'Celebration',
  [NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT]: 'Announcement'
};

// Notification colors
export const NOTIFICATION_COLORS = {
  [NOTIFICATION_TYPES.PROJECT_SUBMITTED]: 'info',
  [NOTIFICATION_TYPES.PROJECT_APPROVED]: 'success',
  [NOTIFICATION_TYPES.PROJECT_REJECTED]: 'error',
  [NOTIFICATION_TYPES.FEEDBACK_RECEIVED]: 'primary',
  [NOTIFICATION_TYPES.PROJECT_UPDATED]: 'warning',
  [NOTIFICATION_TYPES.PROJECT_DELETED]: 'error',
  [NOTIFICATION_TYPES.ROLE_CHANGED]: 'secondary',
  [NOTIFICATION_TYPES.WELCOME]: 'success',
  [NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT]: 'info'
};

/**
 * Send a notification to a specific user
 * @param {string} userId - The user ID to send notification to
 * @param {string} type - The notification type
 * @param {string} title - The notification title
 * @param {string} message - The notification message
 * @param {Object} data - Additional data for the notification
 */
export const sendNotification = async (userId, type, title, message, data = {}) => {
  try {
    console.log(`=== SEND NOTIFICATION DEBUG ===`);
    console.log(`1. User ID: ${userId}`);
    console.log(`2. Type: ${type}`);
    console.log(`3. Title: ${title}`);
    console.log(`4. Message: ${message}`);
    console.log(`5. Data:`, data);
    
    // Write to root-level notifications per Firestore rules
    const notificationRef = collection(db, 'notifications');
    console.log(`6. Notification collection path: notifications (root)`);
    
    const notificationData = {
      recipientId: userId,
      type,
      title,
      message,
      data,
      read: false,
      createdAt: serverTimestamp(),
      icon: NOTIFICATION_ICONS[type],
      color: NOTIFICATION_COLORS[type]
    };
    
    console.log(`7. Notification data to save:`, notificationData);
    
    const docRef = await addDoc(notificationRef, notificationData);
    console.log(`8. ✅ Notification saved with ID: ${docRef.id}`);
    console.log(`9. ✅ Notification sent to user ${userId}: ${title}`);
  } catch (error) {
    console.error(`❌ Error sending notification to user ${userId}:`, error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
  }
};

/**
 * Send notification to multiple users
 * @param {Array} userIds - Array of user IDs
 * @param {string} type - The notification type
 * @param {string} title - The notification title
 * @param {string} message - The notification message
 * @param {Object} data - Additional data for the notification
 */
export const sendBulkNotifications = async (userIds, type, title, message, data = {}) => {
  try {
    console.log(`Sending bulk notifications to ${userIds.length} users:`, userIds);
    const promises = userIds.map(userId => sendNotification(userId, type, title, message, data));
    await Promise.all(promises);
    console.log(`Successfully sent bulk notifications to ${userIds.length} users`);
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
  }
};

/**
 * Send notification to all users with a specific role
 * @param {string} role - The role to send notifications to
 * @param {string} type - The notification type
 * @param {string} title - The notification title
 * @param {string} message - The notification message
 * @param {Object} data - Additional data for the notification
 */
export const sendNotificationToRole = async (role, type, title, message, data = {}) => {
  try {
    console.log(`Attempting to send notification to role: ${role}`);
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', role));
    const querySnapshot = await getDocs(q);
    const userIds = querySnapshot.docs.map(doc => doc.id);
    console.log(`Found ${userIds.length} users with role '${role}':`, userIds);
    
    if (userIds.length === 0) {
      console.warn(`No users found with role '${role}'. Notification not sent.`);
      return;
    }
    
    await sendBulkNotifications(userIds, type, title, message, data);
    console.log(`Successfully sent notification to ${userIds.length} users with role '${role}'`);
  } catch (error) {
    console.error('Error sending notifications to role:', error);
  }
};

/**
 * Send notification to all faculty members
 * @param {string} type - The notification type
 * @param {string} title - The notification title
 * @param {string} message - The notification message
 * @param {Object} data - Additional data for the notification
 */
export const notifyFaculty = async (type, title, message, data = {}) => {
  await sendNotificationToRole('faculty', type, title, message, data);
};

/**
 * Send notification to all admins
 * @param {string} type - The notification type
 * @param {string} title - The notification title
 * @param {string} message - The notification message
 * @param {Object} data - Additional data for the notification
 */
export const notifyAdmins = async (type, title, message, data = {}) => {
  await sendNotificationToRole('admin', type, title, message, data);
};

/**
 * Send notification to all students
 * @param {string} type - The notification type
 * @param {string} title - The notification title
 * @param {string} message - The notification message
 * @param {Object} data - Additional data for the notification
 */
export const notifyStudents = async (type, title, message, data = {}) => {
  await sendNotificationToRole('student', type, title, message, data);
};

/**
 * Send notification to project owner about user interactions
 * @param {string} projectId - The project ID
 * @param {string} projectTitle - The project title
 * @param {string} interactionType - Type of interaction (like, bookmark, etc.)
 * @param {string} userEmail - Email of the user who interacted
 * @param {string} userName - Name of the user who interacted
 */
export const notifyProjectInteraction = async (projectId, projectTitle, interactionType, userEmail, userName) => {
  try {
    console.log(`=== PROJECT INTERACTION NOTIFICATION DEBUG ===`);
    console.log(`1. Project ID: ${projectId}`);
    console.log(`2. Project Title: ${projectTitle}`);
    console.log(`3. Interaction Type: ${interactionType}`);
    console.log(`4. User Email: ${userEmail}`);
    console.log(`5. User Name: ${userName}`);
    
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    
    if (projectSnap.exists()) {
      const projectData = projectSnap.data();
      console.log(`6. Project Data:`, projectData);
      console.log(`7. Owner ID: ${projectData.ownerId}`);
      console.log(`8. Owner Email: ${projectData.ownerEmail}`);
      
      const ownerId = projectData.ownerId;
      
      if (ownerId) {
        console.log(`9. ✅ Owner ID found, sending notification to: ${ownerId}`);
        
        const interactionLabels = {
          'like': 'liked',
          'bookmark': 'bookmarked',
          'useful': 'marked as useful'
        };
        
        const action = interactionLabels[interactionType] || interactionType;
        const title = 'Project Interaction';
        const message = `${userName} has ${action} your project "${projectTitle}".`;
        
        console.log(`10. Notification Details:`);
        console.log(`    - Title: ${title}`);
        console.log(`    - Message: ${message}`);
        
        await sendNotification(ownerId, NOTIFICATION_TYPES.FEEDBACK_RECEIVED, title, message, {
          projectId,
          projectTitle,
          interactionType,
          userEmail,
          userName,
          action: 'view_project'
        });
        
        console.log(`11. ✅ Interaction notification sent successfully to project owner`);
      } else {
        console.log(`9. ❌ No owner ID found in project data`);
      }
    } else {
      console.log(`6. ❌ Project document does not exist`);
    }
  } catch (error) {
    console.error('Error notifying project interaction:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
  }
};

/**
 * Send notification to project owner when project is approved/rejected
 * @param {string} projectId - The project ID
 * @param {string} status - The new status (approved/rejected)
 * @param {string} feedback - Optional feedback message
 * @param {string} changedBy - Who changed the status
 */
export const notifyProjectStatusChange = async (projectId, status, feedback = '', changedBy = '') => {
  try {
    console.log(`=== PROJECT STATUS CHANGE NOTIFICATION DEBUG ===`);
    console.log(`1. Project ID: ${projectId}`);
    console.log(`2. Status: ${status}`);
    console.log(`3. Changed By: ${changedBy}`);
    console.log(`4. Feedback: ${feedback}`);
    
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    
    if (projectSnap.exists()) {
      const projectData = projectSnap.data();
      console.log(`5. Project Data:`, projectData);
      console.log(`6. Owner ID: ${projectData.ownerId}`);
      console.log(`7. Owner Email: ${projectData.ownerEmail}`);
      console.log(`8. Project Title: ${projectData.title}`);
      
      const ownerId = projectData.ownerId;
      
      if (ownerId) {
        console.log(`9. ✅ Owner ID found, sending notification to: ${ownerId}`);
        
        const type = status === 'approved' ? NOTIFICATION_TYPES.PROJECT_APPROVED : NOTIFICATION_TYPES.PROJECT_REJECTED;
        const title = `Project ${status.charAt(0).toUpperCase() + status.slice(1)}`;
        const message = `Your project "${projectData.title}" has been ${status}${changedBy ? ` by ${changedBy}` : ''}.${feedback ? ` Feedback: ${feedback}` : ''}`;
        
        console.log(`10. Notification Details:`);
        console.log(`    - Type: ${type}`);
        console.log(`    - Title: ${title}`);
        console.log(`    - Message: ${message}`);
        
        await sendNotification(ownerId, type, title, message, {
          projectId,
          projectTitle: projectData.title,
          status,
          feedback,
          changedBy,
          action: 'view_project'
        });
        
        console.log(`11. ✅ Notification sent successfully to project owner`);
      } else {
        console.log(`9. ❌ No owner ID found in project data`);
      }
    } else {
      console.log(`5. ❌ Project document does not exist`);
    }
  } catch (error) {
    console.error('Error notifying project status change:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
  }
};

/**
 * Send notification when feedback is submitted
 * @param {string} projectId - The project ID
 * @param {string} feedbackAuthor - The feedback author
 * @param {string} feedbackText - The feedback text
 */
export const notifyFeedbackSubmitted = async (projectId, feedbackAuthor, feedbackText) => {
  try {
    console.log(`=== FEEDBACK SUBMISSION NOTIFICATION DEBUG ===`);
    console.log(`1. Project ID: ${projectId}`);
    console.log(`2. Feedback Author: ${feedbackAuthor}`);
    console.log(`3. Feedback Text: ${feedbackText}`);
    
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    
    if (projectSnap.exists()) {
      const projectData = projectSnap.data();
      console.log(`4. Project Data:`, projectData);
      console.log(`5. Owner ID: ${projectData.ownerId}`);
      console.log(`6. Owner Email: ${projectData.ownerEmail}`);
      console.log(`7. Project Title: ${projectData.title}`);
      
      const ownerId = projectData.ownerId;
      
      if (ownerId) {
        console.log(`8. ✅ Owner ID found, sending notification to: ${ownerId}`);
        
        const title = 'New Feedback Received';
        const message = `Your project "${projectData.title}" has received new feedback from ${feedbackAuthor}.`;
        
        console.log(`9. Notification Details:`);
        console.log(`    - Title: ${title}`);
        console.log(`    - Message: ${message}`);
        
        await sendNotification(ownerId, NOTIFICATION_TYPES.FEEDBACK_RECEIVED, title, message, {
          projectId,
          projectTitle: projectData.title,
          feedbackAuthor,
          feedbackText
        });
        
        console.log(`10. ✅ Feedback notification sent successfully to project owner`);
      } else {
        console.log(`8. ❌ No owner ID found in project data`);
      }
    } else {
      console.log(`4. ❌ Project document does not exist`);
    }
  } catch (error) {
    console.error('Error notifying feedback submission:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
  }
};

/**
 * Send notification when project is updated
 * @param {string} projectId - The project ID
 * @param {string} projectTitle - The project title
 * @param {string} updatedBy - The email of the user who updated the project
 * @param {Object} changes - Object containing the changes made
 */
export const notifyProjectUpdated = async (projectId, projectTitle, updatedBy, changes = {}) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    
    if (projectSnap.exists()) {
      const projectData = projectSnap.data();
      const ownerId = projectData.ownerId;
      
      if (ownerId) {
        const title = 'Project Updated';
        const message = `Your project "${projectTitle}" has been updated by ${updatedBy}.`;
        
        await sendNotification(ownerId, NOTIFICATION_TYPES.PROJECT_UPDATED, title, message, {
          projectId,
          projectTitle,
          updatedBy,
          changes,
          updatedAt: new Date()
        });
      }
    }
  } catch (error) {
    console.error('Error notifying project update:', error);
  }
};

/**
 * Send notification when new project is submitted (notify faculty)
 * @param {string} projectId - The project ID
 * @param {string} projectTitle - The project title
 * @param {string} ownerEmail - The project owner email
 */
export const notifyNewProjectSubmission = async (projectId, projectTitle, ownerEmail) => {
  try {
    console.log(`Notifying faculty about new project submission:`, { projectId, projectTitle, ownerEmail });
    const title = 'New Project Submission';
    const message = `A new project "${projectTitle}" has been submitted by ${ownerEmail}. Please review and provide feedback.`;
    
    await notifyFaculty(NOTIFICATION_TYPES.PROJECT_SUBMITTED, title, message, {
      projectId,
      projectTitle,
      ownerEmail,
      submittedAt: new Date()
    });
    console.log(`Successfully notified faculty about new project submission: ${projectTitle}`);
  } catch (error) {
    console.error('Error notifying new project submission:', error);
  }
};

/**
 * Send welcome notification to new user
 * @param {string} userId - The user ID
 * @param {string} userEmail - The user email
 * @param {string} role - The user role
 */
export const sendWelcomeNotification = async (userId, userEmail, role) => {
  const title = 'Welcome to ProjectVault!';
  const message = `Welcome ${userEmail}! Your account has been created successfully. You can now start submitting and reviewing projects.`;
  
  await sendNotification(userId, NOTIFICATION_TYPES.WELCOME, title, message, {
    role,
    userEmail
  });
};

/**
 * Send system announcement to all users
 * @param {string} title - The announcement title
 * @param {string} message - The announcement message
 */
export const sendSystemAnnouncement = async (title, message) => {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    const userIds = querySnapshot.docs.map(doc => doc.id);
    
    await sendBulkNotifications(userIds, NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT, title, message);
  } catch (error) {
    console.error('Error sending system announcement:', error);
  }
};

/**
 * Mark notification as read
 * @param {string} userId - The user ID
 * @param {string} notificationId - The notification ID
 */
export const markNotificationAsRead = async (userId, notificationId) => {
  try {
    // Root-level notifications with recipientId
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, { read: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

/**
 * Delete a notification
 * @param {string} userId - The user ID
 * @param {string} notificationId - The notification ID
 */
export const deleteNotification = async (userId, notificationId) => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await deleteDoc(notificationRef);
  } catch (error) {
    console.error('Error deleting notification:', error);
  }
}; 

/**
 * Send notification to all users about a new project
 * @param {string} projectId - The project ID
 * @param {string} projectTitle - The project title
 * @param {string} ownerEmail - The project owner's email
 * @param {string} ownerName - The project owner's name
 */
export const notifyAllUsersNewProject = async (projectId, projectTitle, ownerEmail, ownerName) => {
  try {
    console.log(`Notifying all users about new project: ${projectTitle}`);
    
    // Get all users
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);
    const userIds = usersSnap.docs.map(doc => doc.id);
    
    const title = 'New Project Added';
    const message = `A new project "${projectTitle}" has been submitted by ${ownerName}`;
    const data = {
      projectId,
      projectTitle,
      ownerEmail,
      ownerName,
      action: 'view_project'
    };
    
    await sendBulkNotifications(userIds, NOTIFICATION_TYPES.PROJECT_SUBMITTED, title, message, data);
    console.log(`Successfully notified ${userIds.length} users about new project`);
  } catch (error) {
    console.error('Error notifying all users about new project:', error);
  }
};

/**
 * Send notification to all users about a project update
 * @param {string} projectId - The project ID
 * @param {string} projectTitle - The project title
 * @param {string} updatedBy - Who updated the project
 * @param {Object} changes - What was changed
 */
export const notifyAllUsersProjectUpdate = async (projectId, projectTitle, updatedBy, changes = {}) => {
  try {
    console.log(`Notifying all users about project update: ${projectTitle}`);
    
    // Get all users
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);
    const userIds = usersSnap.docs.map(doc => doc.id);
    
    const title = 'Project Updated';
    const message = `Project "${projectTitle}" has been updated by ${updatedBy}`;
    const data = {
      projectId,
      projectTitle,
      updatedBy,
      changes,
      action: 'view_project'
    };
    
    await sendBulkNotifications(userIds, NOTIFICATION_TYPES.PROJECT_UPDATED, title, message, data);
    console.log(`Successfully notified ${userIds.length} users about project update`);
  } catch (error) {
    console.error('Error notifying all users about project update:', error);
  }
};

/**
 * Send notification to all users about a project deletion
 * @param {string} projectId - The project ID
 * @param {string} projectTitle - The project title
 * @param {string} deletedBy - Who deleted the project
 * @param {string} reason - Reason for deletion (optional)
 */
export const notifyAllUsersProjectDeletion = async (projectId, projectTitle, deletedBy, reason = '') => {
  try {
    console.log(`Notifying all users about project deletion: ${projectTitle}`);
    
    // Get all users
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);
    const userIds = usersSnap.docs.map(doc => doc.id);
    
    const title = 'Project Deleted';
    const message = reason 
      ? `Project "${projectTitle}" has been deleted by ${deletedBy}. Reason: ${reason}`
      : `Project "${projectTitle}" has been deleted by ${deletedBy}`;
    const data = {
      projectId,
      projectTitle,
      deletedBy,
      reason,
      action: 'project_deleted'
    };
    
    await sendBulkNotifications(userIds, NOTIFICATION_TYPES.PROJECT_DELETED, title, message, data);
    console.log(`Successfully notified ${userIds.length} users about project deletion`);
  } catch (error) {
    console.error('Error notifying all users about project deletion:', error);
  }
};

/**
 * Send notification to all users about project status change
 * @param {string} projectId - The project ID
 * @param {string} projectTitle - The project title
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 * @param {string} changedBy - Who changed the status
 * @param {string} feedback - Feedback (optional)
 */
export const notifyAllUsersProjectStatusChange = async (projectId, projectTitle, oldStatus, newStatus, changedBy, feedback = '') => {
  try {
    console.log(`Notifying all users about project status change: ${projectTitle} from ${oldStatus} to ${newStatus}`);
    
    // Get all users
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);
    const userIds = usersSnap.docs.map(doc => doc.id);
    
    const title = 'Project Status Changed';
    const message = feedback 
      ? `Project "${projectTitle}" status changed from ${oldStatus} to ${newStatus} by ${changedBy}. Feedback: ${feedback}`
      : `Project "${projectTitle}" status changed from ${oldStatus} to ${newStatus} by ${changedBy}`;
    
    const notificationType = newStatus === 'approved' ? NOTIFICATION_TYPES.PROJECT_APPROVED : NOTIFICATION_TYPES.PROJECT_REJECTED;
    const data = {
      projectId,
      projectTitle,
      oldStatus,
      newStatus,
      changedBy,
      feedback,
      action: 'view_project'
    };
    
    await sendBulkNotifications(userIds, notificationType, title, message, data);
    console.log(`Successfully notified ${userIds.length} users about project status change`);
  } catch (error) {
    console.error('Error notifying all users about project status change:', error);
  }
}; 

/**
 * Send notification to project owner using Cloud Function (solves permission issues)
 * @param {string} projectId - The project ID
 * @param {string} notificationType - The notification type
 * @param {string} title - The notification title
 * @param {string} message - The notification message
 * @param {Object} additionalData - Additional data for the notification
 */
export const sendProjectOwnerNotificationViaCloudFunction = async (projectId, notificationType, title, message, additionalData = {}) => {
  try {
    console.log(`=== CLOUD FUNCTION NOTIFICATION DEBUG ===`);
    console.log(`1. Project ID: ${projectId}`);
    console.log(`2. Notification Type: ${notificationType}`);
    console.log(`3. Title: ${title}`);
    console.log(`4. Message: ${message}`);
    console.log(`5. Additional Data:`, additionalData);

    const functions = getFunctions();
    const sendNotification = httpsCallable(functions, 'sendProjectOwnerNotification');
    
    const result = await sendNotification({
      projectId,
      notificationType,
      title,
      message,
      additionalData
    });

    console.log(`6. ✅ Cloud Function Result:`, result.data);
    return result.data;
  } catch (error) {
    console.error('❌ Error sending notification via Cloud Function:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Send notification to project owner when project is approved/rejected (using Cloud Function)
 * @param {string} projectId - The project ID
 * @param {string} status - The new status (approved/rejected)
 * @param {string} feedback - Optional feedback message
 * @param {string} changedBy - Who changed the status
 */
export const notifyProjectStatusChangeViaCloudFunction = async (projectId, status, feedback = '', changedBy = '') => {
  try {
    console.log(`=== PROJECT STATUS CHANGE CLOUD FUNCTION DEBUG ===`);
    console.log(`1. Project ID: ${projectId}`);
    console.log(`2. Status: ${status}`);
    console.log(`3. Changed By: ${changedBy}`);
    console.log(`4. Feedback: ${feedback}`);
    
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    
    if (projectSnap.exists()) {
      const projectData = projectSnap.data();
      console.log(`5. Project Data:`, projectData);
      console.log(`6. Owner ID: ${projectData.ownerId}`);
      console.log(`7. Owner Email: ${projectData.ownerEmail}`);
      console.log(`8. Project Title: ${projectData.title}`);
      
      const notificationType = status === 'approved' ? 'project_approved' : 'project_rejected';
      const title = `Project ${status.charAt(0).toUpperCase() + status.slice(1)}`;
      const message = `Your project "${projectData.title}" has been ${status}${changedBy ? ` by ${changedBy}` : ''}.${feedback ? ` Feedback: ${feedback}` : ''}`;
      
      const additionalData = {
        projectId,
        projectTitle: projectData.title,
        status,
        feedback,
        changedBy,
        action: 'view_project'
      };
      
      console.log(`9. Sending via Cloud Function...`);
      await sendProjectOwnerNotificationViaCloudFunction(projectId, notificationType, title, message, additionalData);
      console.log(`10. ✅ Project status change notification sent successfully via Cloud Function`);
    } else {
      console.log(`5. ❌ Project document does not exist`);
    }
  } catch (error) {
    console.error('Error notifying project status change via Cloud Function:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
  }
}; 

/**
 * Send notification to project owner using root-level notifications collection
 * @param {string} projectId - The project ID
 * @param {string} notificationType - The notification type
 * @param {string} title - The notification title
 * @param {string} message - The notification message
 * @param {Object} additionalData - Additional data for the notification
 */
export const sendProjectOwnerNotificationSimple = async (projectId, notificationType, title, message, additionalData = {}) => {
  try {
    console.log(`=== SIMPLE NOTIFICATION DEBUG ===`);
    console.log(`1. Project ID: ${projectId}`);
    console.log(`2. Notification Type: ${notificationType}`);
    console.log(`3. Title: ${title}`);
    console.log(`4. Message: ${message}`);
    console.log(`5. Additional Data:`, additionalData);

    // Get the project to find the owner
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    
    if (!projectSnap.exists()) {
      console.log(`6. ❌ Project not found`);
      return;
    }

    const projectData = projectSnap.data();
    const ownerId = projectData.ownerId;
    
    console.log(`6. Project Data:`, projectData);
    console.log(`7. Owner ID: ${ownerId}`);
    console.log(`8. Owner Email: ${projectData.ownerEmail}`);

    if (!ownerId) {
      console.log(`9. ❌ No owner ID found in project data`);
      return;
    }

    // Create notification in root-level collection
    const notificationData = {
      recipientId: ownerId,
      type: notificationType,
      title: title,
      message: message,
      data: additionalData || {},
      read: false,
      createdAt: serverTimestamp(),
      icon: NOTIFICATION_ICONS[notificationType] || 'Info',
      color: NOTIFICATION_COLORS[notificationType] || 'info'
    };

    console.log(`9. Notification data to save:`, notificationData);

    const notificationRef = collection(db, 'notifications');
    const docRef = await addDoc(notificationRef, notificationData);
    
    console.log(`10. ✅ Notification saved with ID: ${docRef.id}`);
    console.log(`11. ✅ Notification sent to project owner: ${ownerId}`);
    
    return docRef.id;
  } catch (error) {
    console.error('❌ Error sending simple notification:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Send notification to project owner when project is approved/rejected (simple approach)
 * @param {string} projectId - The project ID
 * @param {string} status - The new status (approved/rejected)
 * @param {string} feedback - Optional feedback message
 * @param {string} changedBy - Who changed the status
 */
export const notifyProjectStatusChangeSimple = async (projectId, status, feedback = '', changedBy = '') => {
  try {
    console.log(`=== PROJECT STATUS CHANGE SIMPLE DEBUG ===`);
    console.log(`1. Project ID: ${projectId}`);
    console.log(`2. Status: ${status}`);
    console.log(`3. Changed By: ${changedBy}`);
    console.log(`4. Feedback: ${feedback}`);
    
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    
    if (projectSnap.exists()) {
      const projectData = projectSnap.data();
      console.log(`5. Project Data:`, projectData);
      console.log(`6. Owner ID: ${projectData.ownerId}`);
      console.log(`7. Owner Email: ${projectData.ownerEmail}`);
      console.log(`8. Project Title: ${projectData.title}`);
      
      const notificationType = status === 'approved' ? NOTIFICATION_TYPES.PROJECT_APPROVED : NOTIFICATION_TYPES.PROJECT_REJECTED;
      const title = `Project ${status.charAt(0).toUpperCase() + status.slice(1)}`;
      const message = `Your project "${projectData.title}" has been ${status}${changedBy ? ` by ${changedBy}` : ''}.${feedback ? ` Feedback: ${feedback}` : ''}`;
      
      const additionalData = {
        projectId,
        projectTitle: projectData.title,
        status,
        feedback,
        changedBy,
        action: 'view_project'
      };
      
      console.log(`9. Sending simple notification...`);
      await sendProjectOwnerNotificationSimple(projectId, notificationType, title, message, additionalData);
      console.log(`10. ✅ Project status change notification sent successfully via simple method`);
    } else {
      console.log(`5. ❌ Project document does not exist`);
    }
  } catch (error) {
    console.error('Error notifying project status change via simple method:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
  }
};

/**
 * Send notification to project owner about user interactions (simple approach)
 * @param {string} projectId - The project ID
 * @param {string} projectTitle - The project title
 * @param {string} interactionType - Type of interaction (like, bookmark, etc.)
 * @param {string} userEmail - Email of the user who interacted
 * @param {string} userName - Name of the user who interacted
 */
export const notifyProjectInteractionSimple = async (projectId, projectTitle, interactionType, userEmail, userName) => {
  try {
    console.log(`=== PROJECT INTERACTION SIMPLE DEBUG ===`);
    console.log(`1. Project ID: ${projectId}`);
    console.log(`2. Project Title: ${projectTitle}`);
    console.log(`3. Interaction Type: ${interactionType}`);
    console.log(`4. User Email: ${userEmail}`);
    console.log(`5. User Name: ${userName}`);
    
    const interactionLabels = {
      'like': 'liked',
      'liked': 'liked',
      'bookmark': 'bookmarked',
      'bookmarked': 'bookmarked',
      'useful': 'marked as useful'
    };
    
    const action = interactionLabels[interactionType] || interactionType;
    const title = 'Project Interaction';
    const message = `${userName} has ${action} your project "${projectTitle}".`;
    
    const additionalData = {
      projectId,
      projectTitle,
      interactionType,
      userEmail,
      userName,
      action: 'view_project'
    };
    
    console.log(`6. Sending simple interaction notification...`);
    await sendProjectOwnerNotificationSimple(projectId, NOTIFICATION_TYPES.FEEDBACK_RECEIVED, title, message, additionalData);
    console.log(`7. ✅ Project interaction notification sent successfully via simple method`);
  } catch (error) {
    console.error('Error notifying project interaction via simple method:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
  }
};

/**
 * Send notification to project owner when feedback is submitted (simple approach)
 * @param {string} projectId - The project ID
 * @param {string} feedbackAuthor - The feedback author
 * @param {string} feedbackText - The feedback text
 */
export const notifyFeedbackSubmittedSimple = async (projectId, feedbackAuthor, feedbackText) => {
  try {
    console.log(`=== FEEDBACK SUBMISSION SIMPLE DEBUG ===`);
    console.log(`1. Project ID: ${projectId}`);
    console.log(`2. Feedback Author: ${feedbackAuthor}`);
    console.log(`3. Feedback Text: ${feedbackText}`);
    
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    
    if (projectSnap.exists()) {
      const projectData = projectSnap.data();
      console.log(`4. Project Data:`, projectData);
      console.log(`5. Owner ID: ${projectData.ownerId}`);
      console.log(`6. Owner Email: ${projectData.ownerEmail}`);
      console.log(`7. Project Title: ${projectData.title}`);
      
      const title = 'New Feedback Received';
      const message = `Your project "${projectData.title}" has received new feedback from ${feedbackAuthor}.`;
      
      const additionalData = {
        projectId,
        projectTitle: projectData.title,
        feedbackAuthor,
        feedbackText,
        action: 'view_project'
      };
      
      console.log(`8. Sending simple feedback notification...`);
      await sendProjectOwnerNotificationSimple(projectId, NOTIFICATION_TYPES.FEEDBACK_RECEIVED, title, message, additionalData);
      console.log(`9. ✅ Feedback notification sent successfully via simple method`);
    } else {
      console.log(`4. ❌ Project document does not exist`);
    }
  } catch (error) {
    console.error('Error notifying feedback submission via simple method:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
  }
}; 