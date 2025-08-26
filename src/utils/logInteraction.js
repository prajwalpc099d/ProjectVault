import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function logInteraction(userId, projectId, actionType) {
  try {
    await addDoc(collection(db, "interactions"), {
      userId,
      projectId,
      action: actionType,
      weight: getActionWeight(actionType),
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Error logging interaction:", error);
  }
}

function getActionWeight(action) {
  switch (action) {
    case "view": return 0.3;
    case "star": return 0.7;
    case "fork": return 1.0;
    default: return 0.5;
  }
}