import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { CircularProgress, Box } from '@mui/material';

const RoleBasedRoute = ({ allowedRoles, children }) => {
  const [status, setStatus] = useState({
    loading: true,
    authorized: false,
    role: null,
    error: null
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setStatus({
            loading: false,
            authorized: false,
            role: null,
            error: 'User not authenticated'
          });
          return;
        }

        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setStatus({
            loading: false,
            authorized: false,
            role: null,
            error: 'User record not found'
          });
          return;
        }

        const userRole = docSnap.data().role;
        const normalizedRole = (userRole || '').toLowerCase();
        const allowed = (allowedRoles || []).map(r => (r || '').toLowerCase());
        const isAuthorized = allowed.includes(normalizedRole);

        setStatus({
          loading: false,
          authorized: isAuthorized,
          role: userRole,
          error: isAuthorized ? null : 'Insufficient permissions'
        });

      } catch (err) {
        console.error('Authorization error:', err);
        setStatus({
          loading: false,
          authorized: false,
          role: null,
          error: 'Error checking authorization'
        });
      }
    });

    return () => unsubscribe();
  }, [allowedRoles]);

  if (status.loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!status.authorized) {
    // Optionally log the reason for debugging
    if (status.error) {
      console.log('Authorization failed:', status.error);
    }
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default RoleBasedRoute;