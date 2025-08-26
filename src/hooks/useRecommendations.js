import { useState, useEffect, useCallback } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "../firebase";

export default function useRecommendations() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }

      const functions = getFunctions();
      const getRecs = httpsCallable(functions, "getRecommendations");
      const { data } = await getRecs({ 
        userId: auth.currentUser.uid,
        refresh: lastUpdated ? false : true // Only force refresh on first load
      });
      
      setRecommendations(data.recommendations || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || "Failed to load recommendations");
      console.error("Recommendation error:", {
        error: err,
        message: err.message,
        stack: err.stack
      });
    } finally {
      setLoading(false);
    }
  }, [lastUpdated]);

  // Auto-refresh when auth state changes
  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Optional: Add refresh capability
  const refresh = useCallback(() => {
    setLastUpdated(null); // Reset to force refresh
    fetchRecommendations();
  }, [fetchRecommendations]);

  return { 
    recommendations, 
    loading, 
    error,
    lastUpdated,
    refresh,
    isEmpty: !loading && recommendations.length === 0
  };
}