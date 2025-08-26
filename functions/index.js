const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// Cloud Function to send notifications to project owners
exports.sendProjectOwnerNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to send notifications"
    );
  }

  const { projectId, notificationType, title, message, additionalData } = data;

  try {
    // Get the project to find the owner
    const projectRef = admin.firestore().collection("projects").doc(projectId);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Project not found"
      );
    }

    const projectData = projectSnap.data();
    const ownerId = projectData.ownerId;

    if (!ownerId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Project owner not found"
      );
    }

    // Don't send notification if the sender is the owner
    if (ownerId === context.auth.uid) {
      return { success: true, message: "No notification sent (sender is owner)" };
    }

    // Create the notification
    const notificationData = {
      type: notificationType,
      title: title,
      message: message,
      data: additionalData || {},
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      icon: getNotificationIcon(notificationType),
      color: getNotificationColor(notificationType)
    };

    // Add notification to owner's collection
    const notificationRef = admin.firestore()
      .collection("users")
      .doc(ownerId)
      .collection("notifications");

    await notificationRef.add(notificationData);

    return { 
      success: true, 
      message: "Notification sent successfully",
      notificationId: notificationRef.id
    };

  } catch (error) {
    console.error('Error sending project owner notification:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to send notification: ' + error.message
    );
  }
});

// Helper function to get notification icon
function getNotificationIcon(type) {
  const icons = {
    'project_approved': 'CheckCircle',
    'project_rejected': 'Cancel',
    'feedback_received': 'Comment',
    'project_updated': 'Edit',
    'project_deleted': 'Delete',
    'project_submitted': 'AddCircle',
    'project_interaction': 'ThumbUp'
  };
  return icons[type] || 'Info';
}

// Helper function to get notification color
function getNotificationColor(type) {
  const colors = {
    'project_approved': 'success',
    'project_rejected': 'error',
    'feedback_received': 'primary',
    'project_updated': 'warning',
    'project_deleted': 'error',
    'project_submitted': 'info',
    'project_interaction': 'info'
  };
  return colors[type] || 'info';
}

exports.getRecommendations = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to get recommendations"
    );
  }

  const userId = context.auth.uid;

  try {
    // Get user's liked projects
    const userInteractions = await admin.firestore()
      .collection("users")
      .doc(userId)
      .collection("interactions")
      .where("liked", "==", true)
      .get();

    if (userInteractions.empty) {
      return { recommendations: [] };
    }

    const likedProjectIds = userInteractions.docs.map(doc => doc.id);
    
    // Get tags from liked projects
    const likedProjects = await Promise.all(
      likedProjectIds.map(id => admin.firestore().collection("projects").doc(id).get())
    );

    // Safely get tags from each project
    const likedTags = new Set();
    likedProjects.forEach(project => {
      const tags = project.data()?.tags || []; // Fallback to empty array if tags is missing
      if (Array.isArray(tags)) { // Ensure tags is an array
        tags.forEach(tag => likedTags.add(tag));
      }
    });

    if (likedTags.size === 0) {
      return { recommendations: [] };
    }

    // Find projects with similar tags (excluding already liked ones)
    const recommendationsQuery = await admin.firestore()
      .collection("projects")
      .where("tags", "array-contains-any", Array.from(likedTags))
      .limit(10)
      .get();

    const recommendations = recommendationsQuery.docs
      .filter(doc => !likedProjectIds.includes(doc.id))
      .map(doc => {
        const project = doc.data();
        // Safely get project tags
        const projectTags = project.tags || [];
        const commonTags = Array.from(likedTags).filter(tag => 
          Array.isArray(projectTags) && projectTags.includes(tag)
        );
        const matchScore = Math.min(5, Math.max(1, commonTags.length)); // Score 1-5
        
        return {
          id: doc.id,
          title: project.title,
          description: project.description,
          tags: projectTags,
          githubLink: project.githubLink,
          matchScore
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3); // Return top 3 recommendations

    return { recommendations };
  } catch (error) {
    console.error('Error generating recommendations:', error);
    throw new functions.https.HttpsError(
      'internal', 
      'Failed to generate recommendations'
    );
  }
});