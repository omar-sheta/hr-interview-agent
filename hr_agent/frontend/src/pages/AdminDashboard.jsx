import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import AdminInterviewForm from './AdminInterviewForm.jsx';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import { Visibility, Edit, PlayArrow, Pause, Group, Add } from '@mui/icons-material';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [editingInterview, setEditingInterview] = useState(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);

  const loadInterviews = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data } = await api.get('/api/admin/interviews', {
        params: { admin_id: user.user_id },
      });
      setInterviews(data.interviews || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to load interviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInterviews();
  }, [user]);

  const handleSaveInterview = async (payload, isUpdate) => {
    const { id, ...body } = payload;
    const requestBody = { admin_id: user.user_id, ...body };
    if (isUpdate && id) {
      await api.put(`/api/admin/interviews/${id}`, requestBody);
    } else {
      await api.post('/api/admin/interviews', requestBody);
    }
    await loadInterviews();
    setEditingInterview(null);
    setFormDialogOpen(false);
  };

  const handleCreateNew = () => {
    setEditingInterview(null);
    setFormDialogOpen(true);
  };

  const handleEditInterview = (interview) => {
    setEditingInterview(interview);
    setFormDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setFormDialogOpen(false);
    setEditingInterview(null);
  };

  const handleToggleActive = async (interview) => {
    await api.put(`/api/admin/interviews/${interview.id}`, {
      admin_id: user.user_id,
      active: !interview.active,
    });
    await loadInterviews();
  };

  return (
    <>
      <Navbar />
      <Container component="main" maxWidth="xl" sx={{ mt: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Admin Dashboard
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" startIcon={<Add />} onClick={handleCreateNew}>
              Create Template
            </Button>
            <Button variant="contained" startIcon={<Visibility />} onClick={() => navigate('/admin/results')}>
              View All Results
            </Button>
          </Box>
        </Box>

        <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 2 }}>
          Interview Templates
        </Typography>
        
        {loading && <CircularProgress />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        {!loading && (
          <Grid container spacing={2}>
            {interviews.map((interview) => (
              <Grid item xs={12} sm={6} md={4} key={interview.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="h6" component="h3" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
                        {interview.title}
                      </Typography>
                      <Chip
                        label={interview.active ? 'Active' : 'Inactive'}
                        color={interview.active ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, minHeight: '40px' }}>
                      {interview.description}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', mt: 'auto' }}>
                      <Group fontSize="small" sx={{ mr: 0.5 }} />
                      <Typography variant="caption">
                        {interview.allowed_candidate_ids?.length || 0} candidate(s) assigned
                      </Typography>
                    </Box>
                  </CardContent>
                  <Divider />
                  <CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1 }}>
                    <Button size="small" startIcon={<Edit />} onClick={() => handleEditInterview(interview)}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      startIcon={interview.active ? <Pause /> : <PlayArrow />}
                      onClick={() => handleToggleActive(interview)}
                    >
                      {interview.active ? 'Pause' : 'Activate'}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
            {!interviews.length && (
              <Grid item xs={12}>
                <Alert severity="info">No interview templates have been created yet. Click "Create Template" to get started.</Alert>
              </Grid>
            )}
          </Grid>
        )}

        <Dialog open={formDialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingInterview ? 'Edit Interview Template' : 'Create New Interview Template'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <AdminInterviewForm
                key={editingInterview?.id || 'new'}
                initialInterview={editingInterview}
                onSave={handleSaveInterview}
                onCancelEdit={handleCloseDialog}
              />
            </Box>
          </DialogContent>
        </Dialog>
      </Container>
    </>
  );
};

export default AdminDashboard;
