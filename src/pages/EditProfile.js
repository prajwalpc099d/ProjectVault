import React, { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Box, Typography, Paper, Button, TextField, CircularProgress, Snackbar, Alert, MenuItem, Select, InputLabel, FormControl } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import * as yup from 'yup';
import { useFormik } from 'formik';

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

const EditProfile = () => {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [role, setRole] = useState('');
  const navigate = useNavigate();

  // All possible fields
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    department: '',
    position: '',
    employeeId: '',
    enrollment: '',
    course: '',
    year: '',
    email: '',
    role: '',
  });

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setForm({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            department: data.department || '',
            position: data.position || '',
            employeeId: data.employeeId || '',
            enrollment: data.enrollment || '',
            course: data.course || '',
            year: data.year || '',
            email: data.email || '',
            role: data.role || '',
          });
          setRole(data.role || '');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [user]);

  // Dynamic year options based on course
  const getYearOptions = () => {
    if (formik.values.course === 'Master of Computer Applications') {
      return ['1st Year', '2nd Year'];
    }
    return ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  };

  // Validation schema (no email/role)
  const validationSchema = yup.object({
    firstName: yup.string().required('Required'),
    lastName: yup.string().required('Required'),
    role: yup.string().required('Required'),
    department: yup.string(),
    position: yup.string(),
    employeeId: yup.string(),
    enrollment: yup.string(),
    course: yup.string(),
    year: yup.string(),
  });

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      ...form,
      role: role // Include role in Formik values
    },
    validationSchema,
    onSubmit: async (values) => {
      setSaving(true);
      try {
        // Manual validation for role-specific fields
        if (values.role === 'faculty' && (!values.department || !values.position || !values.employeeId)) {
          setSnackbar({ open: true, message: 'Please fill all faculty fields', severity: 'error' });
          setSaving(false);
          return;
        }
        if (values.role === 'student' && (!values.enrollment || !values.course || !values.year)) {
          setSnackbar({ open: true, message: 'Please fill all student fields', severity: 'error' });
          setSaving(false);
          return;
        }
        
        const userRef = doc(db, 'users', user.uid);
        // Only update editable fields
        const updateData = {
          firstName: values.firstName,
          lastName: values.lastName,
        };
        if (values.role === 'faculty') {
          updateData.department = values.department;
          updateData.position = values.position;
          updateData.employeeId = values.employeeId;
        }
        if (values.role === 'student') {
          updateData.enrollment = values.enrollment;
          updateData.course = values.course;
          updateData.year = values.year;
        }
        await updateDoc(userRef, updateData);
        setSnackbar({ open: true, message: 'Profile updated successfully!', severity: 'success' });
        setTimeout(() => navigate('/profile'), 1200);
      } catch (err) {
        setSnackbar({ open: true, message: 'Failed to update profile', severity: 'error' });
      } finally {
        setSaving(false);
      }
    },
  });

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8faff 0%, #e8ecff 100%)',
      p: { xs: 2, sm: 3 }
    }}>
      <Box sx={{ maxWidth: 500, mx: 'auto', my: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>Edit Profile</Typography>
        <form onSubmit={formik.handleSubmit}>
          <TextField
            label="First Name"
            name="firstName"
            value={formik.values.firstName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.firstName && Boolean(formik.errors.firstName)}
            helperText={formik.touched.firstName && formik.errors.firstName}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Last Name"
            name="lastName"
            value={formik.values.lastName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.lastName && Boolean(formik.errors.lastName)}
            helperText={formik.touched.lastName && formik.errors.lastName}
            fullWidth
            sx={{ mb: 2 }}
          />
          {/* Show role as disabled field */}
          <TextField
            label="Role"
            name="role"
            value={formik.values.role ? formik.values.role.charAt(0).toUpperCase() + formik.values.role.slice(1) : ''}
            fullWidth
            sx={{ mb: 2 }}
            InputProps={{ readOnly: true }}
          />
          {/* Student fields */}
          {formik.values.role === 'student' && (
            <Box sx={{ mb: 2 }}>
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
          {/* Faculty fields */}
          {formik.values.role === 'faculty' && (
            <Box sx={{ mb: 2 }}>
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
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
            <Button variant="outlined" onClick={() => navigate('/profile')} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving || !formik.isValid}>Save Changes</Button>
          </Box>
        </form>
      </Paper>
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
      </Box>
    </Box>
  );
};

export default EditProfile; 