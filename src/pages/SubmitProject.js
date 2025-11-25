import React, { useState, useEffect } from 'react';
import { 
  TextField, Button, Typography, Box, Alert,
  Select, MenuItem, InputLabel, FormControl, Chip,
  LinearProgress, List, ListItem, ListItemText, IconButton,
  CircularProgress, Paper, Divider, Avatar, Collapse, Dialog,
  DialogTitle, DialogContent, DialogContentText, DialogActions,
  Stepper, Step, StepLabel, Badge, Tooltip
} from '@mui/material';
import { 
  collection, addDoc, Timestamp, doc, getDoc, 
  updateDoc
} from 'firebase/firestore';
import { 
  ref, uploadBytesResumable, getDownloadURL, 
  deleteObject
} from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadIcon from '@mui/icons-material/CloudUpload';
import ReportIcon from '@mui/icons-material/Description';
import ZipIcon from '@mui/icons-material/FolderZip';
import ImageIcon from '@mui/icons-material/Image';
import VideoIcon from '@mui/icons-material/Videocam';
import SuccessIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import HelpIcon from '@mui/icons-material/Help';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { notifyAllUsersNewProject, notifyAllUsersProjectUpdate } from '../utils/notifications';

const MAX_FILE_SIZE_MB = 50;
const MAX_TOTAL_SIZE_MB = 200;
const MAX_IMAGES = 10;
const MAX_VIDEOS = 5;

const tagOptions = [
  'Web Development',
  'Mobile App',
  'Data Science',
  'Machine Learning',
  'AI',
  'IoT',
  'Blockchain',
  'Cybersecurity',
  'Cloud Computing',
  'Game Development',
  'Full Stack',
  'Frontend',
  'Backend',
  'DevOps',
  'Database',
  'API Development',
  'UI/UX Design',
  'Computer Vision',
  'Natural Language Processing',
  'Deep Learning',
  'Robotics',
  'Embedded Systems',
  'Networking',
  'Software Engineering',
  'Web3',
  'AR/VR',
  'Automation',
  'Testing',
  'Microservices',
  'Serverless',
  'Open Source',
  'E-commerce',
  'Social Media',
  'Education',
  'Healthcare',
  'Finance',
  'Other'
];

const statusOptions = [
  { value: 'pending', label: 'Pending Review' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' }
];

const FileTypeIcon = ({ type, size = 'medium' }) => {
  const iconProps = { fontSize: size };
  if (type.includes('zip') || type.includes('rar')) return <ZipIcon color="primary" {...iconProps} />;
  if (type.includes('pdf')) return <ReportIcon color="error" {...iconProps} />;
  if (type.includes('image')) return <ImageIcon color="success" {...iconProps} />;
  if (type.includes('video')) return <VideoIcon color="warning" {...iconProps} />;
  return <UploadIcon {...iconProps} />;
};

const allowedFileTypes = {
  projectZip: ['application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed'],
  reportPdf: ['application/pdf'],
  images: ['image/jpeg', 'image/png', 'image/gif'],
  videos: ['video/mp4', 'video/webm', 'video/ogg']
};

const SubmitProject = ({ editProjectId }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [githubLink, setGithubLink] = useState('');
  const [status, setStatus] = useState('pending');
  const [tags, setTags] = useState([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [user] = useAuthState(auth);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [files, setFiles] = useState({
    projectZip: null,
    reportPdf: null,
    images: [],
    videos: []
  });
  const [uploadProgress, setUploadProgress] = useState({
    projectZip: 0,
    reportPdf: 0,
    images: [],
    videos: [],
    overall: 0
  });
  const [expandedSection, setExpandedSection] = useState('');
  const [showFileSizeWarning, setShowFileSizeWarning] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [filesToDelete, setFilesToDelete] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const calculateTotalSize = () => {
    let total = 0;
    if (files.projectZip) total += files.projectZip.size;
    if (files.reportPdf) total += files.reportPdf.size;
    files.images.forEach(img => total += img.size);
    files.videos.forEach(vid => total += vid.size);
    return total / (1024 * 1024);
  };

  useEffect(() => {
    const totalSize = calculateTotalSize();
    setShowFileSizeWarning(totalSize > MAX_TOTAL_SIZE_MB * 0.8);
  }, [files, calculateTotalSize]);

  useEffect(() => {
    if (editProjectId) {
      const loadProject = async () => {
        try {
          const projectRef = doc(db, 'projects', editProjectId);
          const projectSnap = await getDoc(projectRef);
          
          if (projectSnap.exists()) {
            const projectData = projectSnap.data();
            setTitle(projectData.title);
            setDescription(projectData.description);
            setGithubLink(projectData.githubLink || '');
            setStatus(projectData.status || 'pending');
            setTags(projectData.tags || []);
            setIsEditMode(true);
          }
        } catch (err) {
          console.error("Error loading project:", err);
          setError("Failed to load project for editing");
        }
      };
      
      loadProject();
    }
  }, [editProjectId]);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? '' : section);
  };

  const handleFileChange = (e, field) => {
    const selectedFiles = Array.from(e.target.files);
    let newFiles = [];

    for (const file of selectedFiles) {
      if (!allowedFileTypes[field].includes(file.type)) {
        setError(`Invalid file type for ${file.name}. Expected: ${allowedFileTypes[field].join(', ')}`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`File ${file.name} exceeds maximum size of ${MAX_FILE_SIZE_MB}MB`);
        continue;
      }

      if ((field === 'images' && files.images.length + newFiles.length >= MAX_IMAGES)) {
        setError(`Maximum ${MAX_IMAGES} images allowed`);
        break;
      }

      if ((field === 'videos' && files.videos.length + newFiles.length >= MAX_VIDEOS)) {
        setError(`Maximum ${MAX_VIDEOS} videos allowed`);
        break;
      }

      newFiles.push(file);
    }

    if (newFiles.length > 0) {
      setFiles(prev => ({
        ...prev,
        [field]: field === 'images' || field === 'videos' 
          ? [...prev[field], ...newFiles] 
          : newFiles[0]
      }));
      setError('');
    }
  };

  const removeFile = (field, index) => {
    setFiles(prev => {
      if (field === 'images' || field === 'videos') {
        const updatedFiles = [...prev[field]];
        updatedFiles.splice(index, 1);
        return { ...prev, [field]: updatedFiles };
      }
      return { ...prev, [field]: null };
    });
  };

  const handleTagChange = (event) => {
    const {
      target: { value },
    } = event;
    setTags(typeof value === 'string' ? value.split(',') : value);
  };

  const uploadFile = async (file, path, field, index = null) => {
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => {
            if (field === 'images' || field === 'videos') {
              const newArray = [...prev[field]];
              newArray[index] = progress;
              return { ...prev, [field]: newArray };
            }
            return { ...prev, [field]: progress };
          });
        },
        (error) => {
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({
              url: downloadURL,
              name: file.name,
              type: file.type,
              size: file.size,
              path: uploadTask.snapshot.ref.fullPath
            });
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  };

  const deleteFilesFromStorage = async (filePaths) => {
    try {
      const deletePromises = filePaths.map(path => {
        const fileRef = ref(storage, path);
        return deleteObject(fileRef);
      });
      await Promise.all(deletePromises);
      return true;
    } catch (err) {
      console.error("Error deleting files:", err);
      return false;
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!title.trim()) {
      errors.title = 'Title is required';
    } else if (title.trim().length < 5) {
      errors.title = 'Title must be at least 5 characters';
    } else if (title.trim().length > 100) {
      errors.title = 'Title must be less than 100 characters';
    }
    
    if (!description.trim()) {
      errors.description = 'Description is required';
    } else if (description.trim().length < 20) {
      errors.description = 'Description must be at least 20 characters';
    } else if (description.trim().length > 2000) {
      errors.description = 'Description must be less than 2000 characters';
    }
    
    if (!files.projectZip && !isEditMode) {
      errors.projectZip = 'Project ZIP file is required';
    }
    
    const totalSizeMB = calculateTotalSize();
    if (totalSizeMB > MAX_TOTAL_SIZE_MB) {
      errors.files = `Total files size (${totalSizeMB.toFixed(2)}MB) exceeds maximum limit of ${MAX_TOTAL_SIZE_MB}MB`;
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setValidationErrors({});
    
    // Prevent double submission
    if (isSubmitting) {
      return;
    }
    
    if (!user) {
      setError("You must be logged in to submit a project.");
      return;
    }

    // Validate form
    if (!validateForm()) {
      setError("Please fix the errors in the form before submitting.");
      return;
    }

    // Set submitting state immediately to prevent double clicks
    setIsSubmitting(true);

    setCurrentStep(1);

    try {
      const uploads = {
        projectFile: null,
        report: null,
        images: [],
        videos: []
      };

      const projectId = isEditMode ? editProjectId : Date.now().toString();
      const userId = user.uid;

      const filesToUpload = [
        ...(files.projectZip ? [1] : []),
        ...(files.reportPdf ? [1] : []),
        ...files.images.map(() => 1),
        ...files.videos.map(() => 1)
      ];
      const totalFiles = filesToUpload.length;
      let filesUploaded = 0;

      if (files.projectZip) {
        setCurrentStep(2);
        uploads.projectFile = await uploadFile(
          files.projectZip, 
          `projects/${userId}/${projectId}/${files.projectZip.name}`,
          'projectZip'
        );
        filesUploaded++;
        setUploadProgress(prev => ({
          ...prev,
          overall: Math.round((filesUploaded / totalFiles) * 100)
        }));
      }

      if (files.reportPdf) {
        setCurrentStep(3);
        uploads.report = await uploadFile(
          files.reportPdf, 
          `projects/${userId}/${projectId}/${files.reportPdf.name}`,
          'reportPdf'
        );
        filesUploaded++;
        setUploadProgress(prev => ({
          ...prev,
          overall: Math.round((filesUploaded / totalFiles) * 100)
        }));
      }

      if (files.images.length > 0) {
        setCurrentStep(4);
        for (let i = 0; i < files.images.length; i++) {
          const uploadedImage = await uploadFile(
            files.images[i], 
            `projects/${userId}/${projectId}/images/${files.images[i].name}`,
            'images',
            i
          );
          uploads.images.push(uploadedImage);
          filesUploaded++;
          setUploadProgress(prev => ({
            ...prev,
            overall: Math.round((filesUploaded / totalFiles) * 100)
          }));
        }
      }

      if (files.videos.length > 0) {
        setCurrentStep(5);
        for (let i = 0; i < files.videos.length; i++) {
          const uploadedVideo = await uploadFile(
            files.videos[i], 
            `projects/${userId}/${projectId}/videos/${files.videos[i].name}`,
            'videos',
            i
          );
          uploads.videos.push(uploadedVideo);
          filesUploaded++;
          setUploadProgress(prev => ({
            ...prev,
            overall: Math.round((filesUploaded / totalFiles) * 100)
          }));
        }
      }

      setCurrentStep(6);
      const projectData = {
        title: title.trim(),
        description: description.trim(),
        status,
        tags,
        ownerEmail: user.email,
        ownerId: user.uid,
        updatedAt: Timestamp.now(),
        ...(githubLink.trim() && { githubLink: githubLink.trim() }),
        ...(!isEditMode && { createdAt: Timestamp.now() }),
        ...(!isEditMode && { projectId })
      };

      if (Object.values(uploads).some(val => val !== null && (Array.isArray(val) ? val.length > 0 : true))) {
        projectData.uploads = uploads;
      }

      if (isEditMode) {
        await updateDoc(doc(db, 'projects', projectId), projectData);
        await notifyAllUsersProjectUpdate(projectId, title.trim(), user.email);
      } else {
        console.log('=== PROJECT SUBMISSION DEBUG ===');
        console.log('1. Project data prepared:', projectData);
        console.log('2. Creating project in Firestore...');
        const docRef = await addDoc(collection(db, 'projects'), projectData);
        console.log('3. Project created with ID:', docRef.id);
        console.log('4. Project submitted successfully, sending notification to faculty...');
        
        // Send notification to all users about new project submission
        try {
          console.log('5. Calling notifyAllUsersNewProject...');
          console.log('   - Project ID:', docRef.id);
          console.log('   - Project Title:', title.trim());
          console.log('   - Owner Email:', user.email);
          
          const ownerName = user.displayName || user.email.split('@')[0];
          await notifyAllUsersNewProject(docRef.id, title.trim(), user.email, ownerName);
          console.log('6. ✅ Notification sent to all users successfully');
        } catch (notificationError) {
          console.error('6. ❌ Error sending notification to all users:', notificationError);
          console.error('   - Error code:', notificationError.code);
          console.error('   - Error message:', notificationError.message);
          console.error('   - Error stack:', notificationError.stack);
          // Don't fail the project submission if notification fails
        }
      }

      if (filesToDelete.length > 0) {
        await deleteFilesFromStorage(filesToDelete);
      }

      setCurrentStep(7);
      setUploadProgress(prev => ({ ...prev, overall: 100 }));
      setSuccess(true);

      if (!isEditMode) {
        setTitle('');
        setDescription('');
        setGithubLink('');
        setStatus('pending');
        setTags([]);
        setFiles({
          projectZip: null,
          reportPdf: null,
          images: [],
          videos: []
        });
        // Scroll to success message
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      }
    } catch (err) {
      console.error("Error submitting project:", err);
      setError(err.message || "Failed to submit project. Please try again.");
      setCurrentStep(0);
    } finally {
      // Always reset submitting state
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    if (window.confirm('Are you sure you want to reset the form? All unsaved changes will be lost.')) {
      setTitle('');
      setDescription('');
      setGithubLink('');
      setStatus('pending');
      setTags([]);
      setFiles({
        projectZip: null,
        reportPdf: null,
        images: [],
        videos: []
      });
      setError('');
      setSuccess(false);
      setValidationErrors({});
      setUploadProgress({
        projectZip: 0,
        reportPdf: 0,
        images: [],
        videos: [],
        overall: 0
      });
    }
  };

  const steps = [
    'Enter Project Details',
    'Upload Project Files',
    'Review and Submit',
    'Processing...',
    'Complete'
  ];

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8faff 0%, #e8ecff 100%)',
      p: { xs: 2, sm: 3 },
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      py: { xs: 3, sm: 4 }
    }}>
      <Paper elevation={3} sx={{ 
        maxWidth: 900, 
        width: '100%',
        mx: 'auto', 
        p: { xs: 2, sm: 4 }, 
        borderRadius: 3,
        my: { xs: 2, sm: 3 }
      }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
          {isEditMode ? 'Edit Project' : 'Submit New Project'}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          {isEditMode ? 'Update your project details' : 'Share your work with the community'}
        </Typography>
      </Box>

      <Stepper activeStep={currentStep} alternativeLabel sx={{ mb: 4, display: { xs: 'none', sm: 'flex' } }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      
      {/* Mobile stepper */}
      <Box sx={{ display: { xs: 'block', sm: 'none' }, mb: 4 }}>
        <Typography variant="subtitle1" sx={{ textAlign: 'center', mb: 2 }}>
          Step {currentStep + 1} of {steps.length}: {steps[currentStep]}
        </Typography>
        <LinearProgress 
          variant="determinate" 
          value={((currentStep + 1) / steps.length) * 100} 
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      {success && (
        <Alert 
          severity="success" 
          sx={{ 
            mb: 3,
            animation: 'slideIn 0.5s ease-out',
            '@keyframes slideIn': {
              from: {
                opacity: 0,
                transform: 'translateY(-20px)'
              },
              to: {
                opacity: 1,
                transform: 'translateY(0)'
              }
            }
          }}
          icon={<SuccessIcon fontSize="inherit" />}
          onClose={() => setSuccess(false)}
          action={
            !isEditMode && (
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => {
                  setSuccess(false);
                  setCurrentStep(0);
                }}
              >
                Submit Another
              </Button>
            )
          }
        >
          <Typography variant="h6" gutterBottom>
            🎉 Project {isEditMode ? 'updated' : 'submitted'} successfully!
          </Typography>
          <Typography variant="body2">
            {isEditMode 
              ? 'Your project has been updated and changes will be visible to all users.'
              : 'Your project is now pending review. You will be notified once it\'s approved.'}
          </Typography>
        </Alert>
      )}

      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          icon={<ErrorIcon fontSize="inherit" />}
          onClose={() => setError('')}
        >
          {error}
        </Alert>
      )}

      {showFileSizeWarning && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          icon={<InfoIcon fontSize="inherit" />}
        >
          Your total files size is approaching the maximum limit of {MAX_TOTAL_SIZE_MB}MB.
        </Alert>
      )}

      {(uploadProgress.overall > 0 && uploadProgress.overall < 100) && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            Uploading files... ({uploadProgress.overall}%)
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={uploadProgress.overall} 
            sx={{ height: 8, borderRadius: 4, mb: 2 }}
          />
          
          {files.projectZip && (
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center' }}>
                  <FileTypeIcon type={files.projectZip.type} size="small" />
                  <Box component="span" sx={{ ml: 1 }}>Project Archive</Box>
                </Typography>
                <Typography variant="caption">
                  {uploadProgress.projectZip.toFixed(1)}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={uploadProgress.projectZip} 
                sx={{ height: 4, borderRadius: 2 }}
              />
            </Box>
          )}
          
          {files.reportPdf && (
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center' }}>
                  <FileTypeIcon type={files.reportPdf.type} size="small" />
                  <Box component="span" sx={{ ml: 1 }}>Project Report</Box>
                </Typography>
                <Typography variant="caption">
                  {uploadProgress.reportPdf.toFixed(1)}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={uploadProgress.reportPdf} 
                sx={{ height: 4, borderRadius: 2 }}
              />
            </Box>
          )}
          
          {files.images.length > 0 && files.images.map((file, index) => (
            <Box key={`image-${index}`} sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center' }}>
                  <FileTypeIcon type={file.type} size="small" />
                  <Box component="span" sx={{ ml: 1 }}>Image {index + 1}</Box>
                </Typography>
                <Typography variant="caption">
                  {uploadProgress.images[index]?.toFixed(1) || 0}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={uploadProgress.images[index] || 0} 
                sx={{ height: 4, borderRadius: 2 }}
              />
            </Box>
          ))}
          
          {files.videos.length > 0 && files.videos.map((file, index) => (
            <Box key={`video-${index}`} sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center' }}>
                  <FileTypeIcon type={file.type} size="small" />
                  <Box component="span" sx={{ ml: 1 }}>Video {index + 1}</Box>
                </Typography>
                <Typography variant="caption">
                  {uploadProgress.videos[index]?.toFixed(1) || 0}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={uploadProgress.videos[index] || 0} 
                sx={{ height: 4, borderRadius: 2 }}
              />
            </Box>
          ))}
        </Box>
      )}

      <form onSubmit={handleSubmit}>
        <Paper elevation={1} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              mb: 2,
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('basic')}
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Basic Information
            </Typography>
            {expandedSection === 'basic' ? <RemoveIcon /> : <AddIcon />}
          </Box>
          
          <Collapse in={expandedSection === 'basic' || expandedSection === ''}>
            <TextField
              fullWidth
              margin="normal"
              label="Project Title *"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (validationErrors.title) {
                  setValidationErrors(prev => ({ ...prev, title: '' }));
                }
              }}
              required
              variant="outlined"
              error={!!validationErrors.title}
              helperText={validationErrors.title || `${title.length}/100 characters`}
              inputProps={{ maxLength: 100 }}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              margin="normal"
              label="Description *"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (validationErrors.description) {
                  setValidationErrors(prev => ({ ...prev, description: '' }));
                }
              }}
              multiline
              rows={6}
              required
              variant="outlined"
              error={!!validationErrors.description}
              helperText={validationErrors.description || `${description.length}/2000 characters (minimum 20)`}
              inputProps={{ maxLength: 2000 }}
            />
            
            <TextField
              fullWidth
              margin="normal"
              label="GitHub Repository Link (Optional)"
              value={githubLink}
              onChange={(e) => setGithubLink(e.target.value)}
              variant="outlined"
              placeholder="https://github.com/username/repository"
              helperText="Share your project's GitHub repository link"
              sx={{ mt: 2 }}
            />
          </Collapse>
        </Paper>

        <Paper elevation={1} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              mb: 2,
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('files')}
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Project Files
            </Typography>
            {expandedSection === 'files' ? <RemoveIcon /> : <AddIcon />}
          </Box>
          
          <Collapse in={expandedSection === 'files' || expandedSection === ''}>
            {/* File Size Summary */}
            {calculateTotalSize() > 0 && (
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  mb: 3, 
                  bgcolor: showFileSizeWarning ? 'warning.light' : 'info.light',
                  borderRadius: 2
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Total Files Size: {calculateTotalSize().toFixed(2)} MB / {MAX_TOTAL_SIZE_MB} MB
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={(calculateTotalSize() / MAX_TOTAL_SIZE_MB) * 100} 
                    sx={{ width: '60%', height: 8, borderRadius: 4 }}
                    color={showFileSizeWarning ? 'warning' : 'primary'}
                  />
                </Box>
              </Paper>
            )}
            
            {validationErrors.files && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {validationErrors.files}
              </Alert>
            )}
            
            <FormControl fullWidth margin="normal" error={!!validationErrors.projectZip}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ZipIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="subtitle1">
                  Project Files (ZIP/RAR) {!isEditMode && '*'}
                </Typography>
                <Tooltip title="Upload your project source code in a compressed format (Max 50MB per file)">
                  <HelpIcon color="action" sx={{ ml: 1 }} />
                </Tooltip>
              </Box>
              {validationErrors.projectZip && (
                <Typography variant="caption" color="error" sx={{ mb: 1, display: 'block' }}>
                  {validationErrors.projectZip}
                </Typography>
              )}
              <input
                accept=".zip,.rar"
                style={{ display: 'none' }}
                id="project-zip-upload"
                type="file"
                onChange={(e) => handleFileChange(e, 'projectZip')}
                required={!isEditMode}
              />
              <label htmlFor="project-zip-upload">
                <Button 
                  variant="outlined" 
                  component="span"
                  startIcon={<UploadIcon />}
                  sx={{ mb: 2 }}
                >
                  {files.projectZip ? 'Change Archive' : 'Select Archive'}
                </Button>
              </label>
              {files.projectZip && (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ bgcolor: 'primary.light', mr: 2 }}>
                      <FileTypeIcon type={files.projectZip.type} />
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography>{files.projectZip.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {`${(files.projectZip.size / 1024 / 1024).toFixed(2)} MB`}
                      </Typography>
                    </Box>
                    <IconButton onClick={() => removeFile('projectZip')} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Paper>
              )}
              {isEditMode && !files.projectZip && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Current archive will remain unchanged
                </Typography>
              )}
            </FormControl>

            <Divider sx={{ my: 3 }} />

            <FormControl fullWidth margin="normal">
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ReportIcon color="error" sx={{ mr: 1 }} />
                <Typography variant="subtitle1">
                  Project Report (PDF)
                </Typography>
                <Tooltip title="Upload your project documentation or report">
                  <HelpIcon color="action" sx={{ ml: 1 }} />
                </Tooltip>
              </Box>
              <input
                accept=".pdf"
                style={{ display: 'none' }}
                id="report-pdf-upload"
                type="file"
                onChange={(e) => handleFileChange(e, 'reportPdf')}
              />
              <label htmlFor="report-pdf-upload">
                <Button 
                  variant="outlined" 
                  component="span"
                  startIcon={<UploadIcon />}
                  sx={{ mb: 2 }}
                >
                  {files.reportPdf ? 'Change Report' : 'Select Report'}
                </Button>
              </label>
              {files.reportPdf && (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ bgcolor: 'error.light', mr: 2 }}>
                      <FileTypeIcon type={files.reportPdf.type} />
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography>{files.reportPdf.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {`${(files.reportPdf.size / 1024 / 1024).toFixed(2)} MB`}
                      </Typography>
                    </Box>
                    <IconButton onClick={() => removeFile('reportPdf')} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Paper>
              )}
              {isEditMode && !files.reportPdf && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Current report will remain unchanged
                </Typography>
              )}
            </FormControl>

            <Divider sx={{ my: 3 }} />

            <FormControl fullWidth margin="normal">
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ImageIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="subtitle1">
                  Project Images (JPEG, PNG, GIF)
                </Typography>
                <Badge 
                  badgeContent={files.images.length} 
                  color="primary" 
                  max={MAX_IMAGES}
                  sx={{ ml: 1 }}
                >
                  <Tooltip title={`Max ${MAX_IMAGES} images allowed`}>
                    <HelpIcon color="action" />
                  </Tooltip>
                </Badge>
              </Box>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="images-upload"
                type="file"
                multiple
                onChange={(e) => handleFileChange(e, 'images')}
              />
              <label htmlFor="images-upload">
                <Button 
                  variant="outlined" 
                  component="span"
                  startIcon={<UploadIcon />}
                  sx={{ mb: 2 }}
                  disabled={files.images.length >= MAX_IMAGES}
                >
                  Select Images
                </Button>
              </label>
              {files.images.length > 0 && (
                <List dense>
                  {files.images.map((file, index) => (
                    <Paper key={index} variant="outlined" sx={{ p: 1, mb: 1, borderRadius: 1 }}>
                      <ListItem
                        secondaryAction={
                          <IconButton edge="end" onClick={() => removeFile('images', index)}>
                            <DeleteIcon color="error" />
                          </IconButton>
                        }
                      >
                        <Avatar sx={{ bgcolor: 'success.light', mr: 2 }}>
                          <FileTypeIcon type={file.type} />
                        </Avatar>
                        {/* Image preview */}
                        {file.type.startsWith('image/') && (
                          <Box sx={{ mr: 2 }}>
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
                              onLoad={e => URL.revokeObjectURL(e.target.src)}
                            />
                          </Box>
                        )}
                        <ListItemText
                          primary={file.name}
                          secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
                        />
                      </ListItem>
                    </Paper>
                  ))}
                </List>
              )}
              {isEditMode && files.images.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Current images will remain unchanged
                </Typography>
              )}
            </FormControl>

            <Divider sx={{ my: 3 }} />

            <FormControl fullWidth margin="normal">
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <VideoIcon color="warning" sx={{ mr: 1 }} />
                <Typography variant="subtitle1">
                  Project Videos (MP4, WebM, Ogg)
                </Typography>
                <Badge 
                  badgeContent={files.videos.length} 
                  color="primary" 
                  max={MAX_VIDEOS}
                  sx={{ ml: 1 }}
                >
                  <Tooltip title={`Max ${MAX_VIDEOS} videos allowed`}>
                    <HelpIcon color="action" />
                  </Tooltip>
                </Badge>
              </Box>
              <input
                accept="video/*"
                style={{ display: 'none' }}
                id="videos-upload"
                type="file"
                multiple
                onChange={(e) => handleFileChange(e, 'videos')}
              />
              <label htmlFor="videos-upload">
                <Button 
                  variant="outlined" 
                  component="span"
                  startIcon={<UploadIcon />}
                  sx={{ mb: 2 }}
                  disabled={files.videos.length >= MAX_VIDEOS}
                >
                  Select Videos
                </Button>
              </label>
              {files.videos.length > 0 && (
                <List dense>
                  {files.videos.map((file, index) => (
                    <Paper key={index} variant="outlined" sx={{ p: 1, mb: 1, borderRadius: 1 }}>
                      <ListItem
                        secondaryAction={
                          <IconButton edge="end" onClick={() => removeFile('videos', index)}>
                            <DeleteIcon color="error" />
                          </IconButton>
                        }
                      >
                        <Avatar sx={{ bgcolor: 'warning.light', mr: 2 }}>
                          <FileTypeIcon type={file.type} />
                        </Avatar>
                        {/* Video preview: just show filename and size, optionally a play icon */}
                        <ListItemText
                          primary={file.name}
                          secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
                        />
                      </ListItem>
                    </Paper>
                  ))}
                </List>
              )}
              {isEditMode && files.videos.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Current videos will remain unchanged
                </Typography>
              )}
            </FormControl>
          </Collapse>
        </Paper>

        <Paper elevation={1} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              mb: 2,
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('details')}
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Project Details
            </Typography>
            {expandedSection === 'details' ? <RemoveIcon /> : <AddIcon />}
          </Box>
          
          <Collapse in={expandedSection === 'details' || expandedSection === ''}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Status *</InputLabel>
              <Select
                value={status}
                label="Status *"
                onChange={(e) => setStatus(e.target.value)}
                required
                variant="outlined"
              >
                {statusOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel>Tags</InputLabel>
              <Select
                multiple
                value={tags}
                onChange={handleTagChange}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} color="primary" size="small" />
                    ))}
                  </Box>
                )}
                variant="outlined"
              >
                {tagOptions.map((tag) => (
                  <MenuItem key={tag} value={tag}>
                    {tag}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Collapse>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button 
            variant="outlined" 
            color="error"
            onClick={resetForm}
            sx={{ 
              mt: 2,
              px: 3,
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: 2,
            }}
          >
            Reset Form
          </Button>

          <Button 
            type="submit" 
            variant="contained" 
            color="primary"
            size="large"
            sx={{ 
              mt: 2,
              px: 4,
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: 2,
              boxShadow: 2,
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: 4,
                transform: 'translateY(-2px)'
              },
              '&:disabled': {
                opacity: 0.6,
                cursor: 'not-allowed'
              }
            }}
            disabled={
              isSubmitting || 
              (!files.projectZip && !isEditMode) || 
              uploadProgress.overall > 0 ||
              Object.keys(validationErrors).length > 0
            }
            startIcon={
              (isSubmitting || (uploadProgress.overall > 0 && uploadProgress.overall < 100)) ? (
                <CircularProgress size={20} color="inherit" />
              ) : null
            }
          >
            {isSubmitting 
              ? 'Submitting...' 
              : uploadProgress.overall > 0 && uploadProgress.overall < 100 
                ? 'Processing...' 
                : isEditMode ? 'Update Project' : 'Submit Project'}
          </Button>
        </Box>
      </form>

      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
      >
        <DialogTitle>Confirm File Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete these files? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          <Button 
            onClick={async () => {
              await deleteFilesFromStorage(filesToDelete);
              setFilesToDelete([]);
              setShowDeleteConfirm(false);
            }} 
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      </Paper>
    </Box>
  );
};

export default SubmitProject;