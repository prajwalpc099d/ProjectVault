import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { 
  TextField, 
  Button, 
  Typography, 
  Box, 
  MenuItem, 
  Select, 
  InputLabel, 
  FormControl,
  Alert,
  CircularProgress,

  Paper,
  IconButton,
  InputAdornment,
  Fade,
  Grow,
  Divider
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useNavigate } from 'react-router-dom';
import PasswordStrengthBar from 'react-password-strength-bar';
import * as yup from 'yup';
import { useFormik } from 'formik';
import { sendWelcomeNotification } from '../utils/notifications';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SchoolIcon from '@mui/icons-material/School';
import WorkIcon from '@mui/icons-material/Work';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

// Validation schema
const validationSchema = yup.object({
  email: yup.string()
    .email('Invalid email address')
    .required('Required'),
  password: yup.string()
    .min(8, 'Must be at least 8 characters')
    .matches(/[a-z]/, 'Must contain at least one lowercase letter')
    .matches(/[A-Z]/, 'Must contain at least one uppercase letter')
    .matches(/[0-9]/, 'Must contain at least one number')
    .required('Required'),
  confirmPassword: yup.string()
    .oneOf([yup.ref('password'), null], 'Passwords must match')
    .required('Required'),
  role: yup.string().required('Required'),
  firstName: yup.string().required('Required'),
  lastName: yup.string().required('Required'),
  enrollment: yup.string(),
  course: yup.string(),
  year: yup.string(),
  department: yup.string(),
  position: yup.string(),
  employeeId: yup.string()
});

const courseOptions = [
  'Artificial Intelligence',
  'Computer Science Engineering',
  'Cyber Security',
  'Electrical and Electronical Engineering',
  'Information Science',
  'Master of Computer Applications',
  'Mechanical Engineering',
  'Other'
];
const departmentOptions = [...courseOptions];
const positionOptions = [
  'Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'HOD', 'Other'
];


const Register = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showAdminCode, setShowAdminCode] = useState(false);
  const navigate = useNavigate();

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
      confirmPassword: '',
      role: 'student',
      firstName: '',
      lastName: '',
      enrollment: '',
      course: '',
      year: '',
      department: '',
      position: '',
      employeeId: ''
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      await handleRegister(values);
    },
  });

  // Dynamic year options based on course
  const getYearOptions = () => {
    if (formik.values.course === 'Master of Computer Applications') {
      return ['1st Year', '2nd Year'];
    }
    return ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  };

  const handleRegister = async (values) => {
    setLoading(true);
    setError(null);
    try {
      // Admin code check
      if (values.role === 'admin' && adminCode !== (process.env.REACT_APP_ADMIN_CODE || 'SECRET_ADMIN_CODE')) {
        setError('Invalid admin code.');
        setLoading(false);
        return;
      }
      // Validate faculty fields
      if (values.role === 'faculty' && (!values.department || !values.position || !values.employeeId)) {
        setError('Please fill all faculty fields.');
        setLoading(false);
        return;
      }
      // Validate student fields
      if (values.role === 'student' && (!values.enrollment || !values.course || !values.year)) {
        setError('Please fill all student fields.');
        setLoading(false);
        return;
      }
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        values.email, 
        values.password
      );
      // Send email verification
      await sendEmailVerification(userCredential.user, {
        url: `${window.location.origin}/verify-email?redirect=${values.role}-dashboard`,
      });
      // Create user document in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: values.email,
        role: values.role,
        firstName: values.firstName,
        lastName: values.lastName,
        emailVerified: false,
        createdAt: new Date(),
        lastLogin: null,
        status: 'active',
        ...(values.role === 'faculty' && { department: values.department, position: values.position, employeeId: values.employeeId }),
        ...(values.role === 'admin' && { admin: true }),
        ...(values.role === 'student' && { enrollment: values.enrollment, course: values.course, year: values.year })
      });
      
      // Send welcome notification
      await sendWelcomeNotification(userCredential.user.uid, values.email, values.role);
      
      setSuccess(true);
      setTimeout(() => redirectUser(values.role), 2000);
    } catch (err) {
      let errorMessage = 'Registration failed';
      switch (err.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Email already in use';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Operation not allowed';
          break;
        default:
          errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const redirectUser = (role) => {
    switch(role) {
      case 'admin':
        navigate('/admin-dashboard');
        break;
      case 'faculty':
        navigate('/faculty-dashboard');
        break;
      default:
        navigate('/student-dashboard');
    }
  };

  const getRoleIcon = (role) => {
    switch(role) {
      case 'student': return <SchoolIcon />;
      case 'faculty': return <WorkIcon />;
      case 'admin': return <AdminPanelSettingsIcon />;
      default: return <PersonAddIcon />;
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
          p: { xs: 3, sm: 4 }, 
          width: '100%', 
          maxWidth: 600, 
          borderRadius: 4,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)',
          mx: { xs: 1, sm: 0 },
          maxHeight: '90vh',
          overflow: 'auto'
        }}>
          {/* Header */}
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
                <PersonAddIcon sx={{ fontSize: 40, color: 'white' }} />
              </Box>
            </Grow>
            <Typography variant="h4" gutterBottom sx={{ 
              fontWeight: 700, 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1
            }}>
              Create Account
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Join ProjectVault and start your academic journey
            </Typography>
          </Box>
          
          {error && (
            <Fade in timeout={500}>
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            </Fade>
          )}
          
          {success && (
            <Fade in timeout={500}>
              <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
                Registration successful! Please check your email to verify your account.
              </Alert>
            </Fade>
          )}

          <form onSubmit={formik.handleSubmit}>
            {/* Basic Information Section */}
            <Grow in timeout={1200}>
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                  Personal Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 2 }}>
                  <TextField
                    fullWidth
                    label="First Name"
                    name="firstName"
                    value={formik.values.firstName}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.firstName && Boolean(formik.errors.firstName)}
                    helperText={formik.touched.firstName && formik.errors.firstName}
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
                        }
                      }
                    }}
                  />
                  <TextField
                    fullWidth
                    label="Last Name"
                    name="lastName"
                    value={formik.values.lastName}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.lastName && Boolean(formik.errors.lastName)}
                    helperText={formik.touched.lastName && formik.errors.lastName}
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
                        }
                      }
                    }}
                  />
                </Box>
                
                <TextField
                  fullWidth
                  label="Email Address"
                  name="email"
                  type="email"
                  value={formik.values.email}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.email && Boolean(formik.errors.email)}
                  helperText={formik.touched.email && formik.errors.email}
                  sx={{ 
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
                      }
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <SchoolIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    )
                  }}
                />
              </Box>
            </Grow>

            {/* Role Selection */}
            <Grow in timeout={1400}>
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                  Account Type
                </Typography>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel id="role-label">Select Role</InputLabel>
                  <Select
                    labelId="role-label"
                    label="Select Role"
                    name="role"
                    value={formik.values.role}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.role && Boolean(formik.errors.role)}
                    sx={{ 
                      borderRadius: 2,
                      '& .MuiOutlinedInput-root': {
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
                        }
                      }
                    }}
                    startAdornment={
                      <Box sx={{ mr: 1, color: 'text.secondary' }}>
                        {getRoleIcon(formik.values.role)}
                      </Box>
                    }
                  >
                    <MenuItem value="student">Student</MenuItem>
                    <MenuItem value="faculty">Faculty</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Grow>

            {/* Password Section */}
            <Grow in timeout={1600}>
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                  Security
                </Typography>
                <TextField
                  fullWidth
                  label="Password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.password && Boolean(formik.errors.password)}
                  helperText={formik.touched.password && formik.errors.password}
                  sx={{ 
                    mb: 1,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
                      }
                    }
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          onClick={() => setShowPassword(v => !v)}
                          edge="end"
                          sx={{ color: 'text.secondary' }}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <PasswordStrengthBar password={formik.values.password} />
                
                <TextField
                  fullWidth
                  label="Confirm Password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formik.values.confirmPassword}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.confirmPassword && Boolean(formik.errors.confirmPassword)}
                  helperText={formik.touched.confirmPassword && formik.errors.confirmPassword}
                  sx={{ 
                    mt: 2,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
                      }
                    }
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                          onClick={() => setShowConfirmPassword(v => !v)}
                          edge="end"
                          sx={{ color: 'text.secondary' }}
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grow>

            {/* Role-specific fields */}
            <Grow in timeout={1800}>
              <Box>
                {/* Student extra fields */}
                {formik.values.role === 'student' && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                      Student Information
                    </Typography>
                    <TextField
                      fullWidth
                      label="Enrollment Number"
                      name="enrollment"
                      value={formik.values.enrollment}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.touched.enrollment && Boolean(formik.errors.enrollment)}
                      helperText={formik.touched.enrollment && formik.errors.enrollment}
                      sx={{ mb: 2 }}
                    />
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel id="course-label">Course</InputLabel>
                      <Select
                        labelId="course-label"
                        label="Course"
                        name="course"
                        value={formik.values.course}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.course && Boolean(formik.errors.course)}
                      >
                        {courseOptions.map(opt => (
                          <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth>
                      <InputLabel id="year-label">Year/Semester</InputLabel>
                      <Select
                        labelId="year-label"
                        label="Year/Semester"
                        name="year"
                        value={formik.values.year}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.year && Boolean(formik.errors.year)}
                      >
                        {getYearOptions().map(opt => (
                          <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                )}

                {/* Faculty extra fields */}
                {formik.values.role === 'faculty' && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                      Faculty Information
                    </Typography>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel id="dept-label">Department</InputLabel>
                      <Select
                        labelId="dept-label"
                        label="Department"
                        name="department"
                        value={formik.values.department}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.department && Boolean(formik.errors.department)}
                      >
                        {departmentOptions.map(opt => (
                          <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel id="pos-label">Position</InputLabel>
                      <Select
                        labelId="pos-label"
                        label="Position"
                        name="position"
                        value={formik.values.position}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.position && Boolean(formik.errors.position)}
                      >
                        {positionOptions.map(opt => (
                          <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      fullWidth
                      label="Employee ID"
                      name="employeeId"
                      value={formik.values.employeeId}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.touched.employeeId && Boolean(formik.errors.employeeId)}
                      helperText={formik.touched.employeeId && formik.errors.employeeId}
                    />
                  </Box>
                )}

                {/* Admin extra field */}
                {formik.values.role === 'admin' && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                      Admin Verification
                    </Typography>
                    <TextField
                      fullWidth
                      label="Admin Code"
                      name="adminCode"
                      value={adminCode}
                      onChange={e => setAdminCode(e.target.value)}
                      type={showAdminCode ? 'text' : 'password'}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label={showAdminCode ? 'Hide admin code' : 'Show admin code'}
                              onClick={() => setShowAdminCode(v => !v)}
                              edge="end"
                              sx={{ color: 'text.secondary' }}
                            >
                              {showAdminCode ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Box>
                )}
              </Box>
            </Grow>

            {/* Submit Button */}
            <Grow in timeout={2000}>
              <Box sx={{ mt: 4 }}>
                <Button 
                  type="submit"
                  variant="contained" 
                  disabled={loading || !formik.isValid}
                  fullWidth
                  size="large"
                  sx={{ 
                    py: 2,
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
                    },
                    '&:disabled': {
                      transform: 'none',
                      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                    }
                  }}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </Box>
            </Grow>
          </form>
          
          {/* Sign in link */}
          <Grow in timeout={2200}>
            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <Divider sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Already have an account?
                </Typography>
              </Divider>
              <Button 
                variant="outlined" 
                size="medium" 
                onClick={() => navigate('/login')}
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
                Sign in to existing account
              </Button>
            </Box>
          </Grow>
        </Paper>
      </Fade>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
      `}</style>
    </Box>
  );
};

export default Register;