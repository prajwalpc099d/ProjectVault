import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { TextField, Button, Typography, Box, IconButton, InputAdornment, Paper, Fade, Grow } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert from '@mui/material/Alert';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SchoolIcon from '@mui/icons-material/School';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const loginUser = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, form.email, form.password);
      const user = userCredential.user;

      // Get user role from Firestore
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        setSnackbar({ open: true, message: 'User role not found', severity: 'error' });
        return;
      }
      const userRole = docSnap.data().role;

      // inside loginUser after getting userRole
      if (userRole === 'admin') navigate('/admin-dashboard');
      else if (userRole === 'faculty') navigate('/faculty-dashboard');
      else navigate('/student-dashboard');  // or '/'

    } catch (err) {
      setSnackbar({ open: true, message: 'Login Failed: ' + err.message, severity: 'error' });
    }
  };

  const handlePasswordReset = async () => {
    if (!form.email) {
      setSnackbar({ open: true, message: 'Please enter your email to reset password.', severity: 'warning' });
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, form.email);
      setSnackbar({ open: true, message: 'Password reset email sent! Check your inbox.', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      p: { xs: 2, sm: 0 },
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background decorative elements */}
      <Box sx={{
        position: 'absolute',
        top: -50,
        left: -50,
        width: 200,
        height: 200,
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.1)',
        animation: 'float 6s ease-in-out infinite'
      }} />
      <Box sx={{
        position: 'absolute',
        bottom: -30,
        right: -30,
        width: 150,
        height: 150,
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.08)',
        animation: 'float 8s ease-in-out infinite reverse'
      }} />
      
      <Fade in timeout={800}>
        <Paper elevation={24} sx={{ 
          maxWidth: 450, 
          width: '100%',
          p: { xs: 3, sm: 4 }, 
          borderRadius: 4,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Header with icon */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Grow in timeout={1000}>
              <Box sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                mb: 2,
                boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
              }}>
                <LockOutlinedIcon sx={{ fontSize: 40, color: 'white' }} />
              </Box>
            </Grow>
            <Typography variant="h4" gutterBottom sx={{ 
              fontWeight: 700, 
              background: 'linear-gradient(135deg,rgb(0, 47, 255) 0%,rgb(26, 154, 223) 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1
            }}>
              Welcome Back
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Sign in to your ProjectVault account
            </Typography>
          </Box>

          {/* Form */}
          <Grow in timeout={1200}>
            <Box>
              <TextField
                fullWidth
                label="Email Address"
                name="email"
                type="email"
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                sx={{ 
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)'
                    },
                    '&.Mui-focused': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(102, 126, 234, 0.2)'
                    }
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <SchoolIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  )
                }}
              />
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                sx={{ 
                  mb: 4,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)'
                    },
                    '&.Mui-focused': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(102, 126, 234, 0.2)'
                    }
                  }
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((v) => !v)}
                        edge="end"
                        sx={{ color: 'text.secondary' }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              
              <Button 
                variant="contained" 
                onClick={loginUser} 
                fullWidth 
                sx={{ 
                  minHeight: 56,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: '0 12px 35px rgba(102, 126, 234, 0.4)',
                    background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
                  }
                }}
              >
                Sign In
              </Button>
            </Box>
          </Grow>

          {/* Action buttons */}
          <Grow in timeout={1400}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' }, 
              gap: 2, 
              justifyContent: 'center',
              mt: 4,
              pt: 3,
              borderTop: '1px solid rgba(0, 0, 0, 0.08)'
            }}>
              <Button 
                variant="text" 
                onClick={handlePasswordReset} 
                disabled={resetLoading} 
                size="medium"
                sx={{ 
                  textTransform: 'none',
                  fontWeight: 500,
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'primary.main',
                    background: 'rgba(102, 126, 234, 0.08)'
                  }
                }}
              >
                Forgot Password?
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => navigate('/register')} 
                size="medium"
                sx={{ 
                  textTransform: 'none',
                  fontWeight: 500,
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '&:hover': {
                    background: 'rgba(102, 126, 234, 0.08)',
                    borderColor: 'primary.dark'
                  }
                }}
              >
                Create Account
              </Button>
            </Box>
          </Grow>
        </Paper>
      </Fade>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <MuiAlert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
      `}</style>
    </Box>
  );
};

export default Login;
