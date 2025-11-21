import { useEffect, useState } from 'react';
import {
  Box, Grid, Typography, Card, CardContent, CardActions, Button, Chip,
  CircularProgress, Alert, Divider, alpha, useTheme, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Autocomplete, Checkbox
} from '@mui/material';
import { Edit, PlayArrow, Pause, Group, Delete, Add, CheckBoxOutlineBlank, CheckBox, Visibility } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { motion } from 'framer-motion';

const icon = <CheckBoxOutlineBlank fontSize="small" />;
const checkedIcon = <CheckBox fontSize="small" />;

const AdminInterviews = () => {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const theme = useTheme();

  // Edit Dialog State
  const [editOpen, setEditOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    allowed_candidate_ids: []
  });

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [interviewsRes, candidatesRes] = await Promise.all([
        api.get('/api/admin/interviews', { params: { admin_id: user.user_id } }),
        api.get('/api/admin/candidates', { params: { admin_id: user.user_id } })
      ]);
      setInterviews(interviewsRes.data.interviews || []);
      setCandidates(candidatesRes.data.candidates || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleToggleActive = async (interview) => {
    await api.put(`/api/admin/interviews/${interview.id}`, {
      admin_id: user.user_id,
      active: !interview.active,
    });
    await loadData();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this interview?')) {
      try {
        await api.delete(`/api/admin/interviews/${id}`, {
          params: { admin_id: user.user_id },
        });
        await loadData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleEditClick = (interview) => {
    setEditingInterview(interview);
    setEditForm({
      title: interview.title,
      description: interview.description || '',
      allowed_candidate_ids: interview.allowed_candidate_ids || []
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    try {
      await api.put(`/api/admin/interviews/${editingInterview.id}`, {
        admin_id: user.user_id,
        ...editForm
      });
      setEditOpen(false);
      setEditingInterview(null);
      await loadData();
    } catch (err) {
      console.error('Failed to update interview:', err);
      alert('Failed to update interview');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" fontWeight="800" sx={{ letterSpacing: '-0.5px' }}>
          Interviews
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/admin/interviews/create')}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Create New
        </Button>
      </Box>

      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={3}>
        {interviews.map((interview) => (
          <Grid item xs={12} sm={6} md={4} key={interview.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                backgroundColor: alpha(theme.palette.background.paper, 0.6),
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-4px)' }
              }}
            >
              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" fontWeight="700">{interview.title}</Typography>
                  <Chip
                    label={interview.active ? 'Active' : 'Inactive'}
                    color={interview.active ? 'success' : 'default'}
                    size="small"
                    sx={{ fontWeight: 600, borderRadius: 1.5 }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                  {interview.description}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                  <Group fontSize="small" sx={{ mr: 0.5 }} />
                  <Typography variant="caption" fontWeight="600">
                    {interview.allowed_candidate_ids?.length || 0} candidates
                  </Typography>
                </Box>
              </CardContent>
              <Divider sx={{ opacity: 0.5 }} />
              <CardActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
                <Button
                  size="small"
                  startIcon={<Edit />}
                  sx={{ fontWeight: 600 }}
                  onClick={() => handleEditClick(interview)}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  startIcon={<Visibility />}
                  sx={{ fontWeight: 600 }}
                  onClick={() => navigate(`/admin/interviews/${interview.id}`)}
                >
                  View
                </Button>
                <Button
                  size="small"
                  startIcon={interview.active ? <Pause /> : <PlayArrow />}
                  color={interview.active ? 'warning' : 'success'}
                  onClick={() => handleToggleActive(interview)}
                  sx={{ fontWeight: 600 }}
                >
                  {interview.active ? 'Pause' : 'Activate'}
                </Button>
                <Button size="small" color="error" startIcon={<Delete />} onClick={() => handleDelete(interview.id)} sx={{ fontWeight: 600 }}>Delete</Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Interview</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Title"
              fullWidth
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            />

            <Autocomplete
              multiple
              options={candidates}
              disableCloseOnSelect
              getOptionLabel={(option) => option.username || option.email}
              value={candidates.filter(c => editForm.allowed_candidate_ids.includes(c.id))}
              onChange={(event, newValue) => {
                setEditForm({
                  ...editForm,
                  allowed_candidate_ids: newValue.map(c => c.id)
                });
              }}
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox
                    icon={icon}
                    checkedIcon={checkedIcon}
                    style={{ marginRight: 8 }}
                    checked={selected}
                  />
                  {option.username} ({option.email})
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} label="Assigned Candidates" placeholder="Select candidates" />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSave} variant="contained">Save Changes</Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
};

export default AdminInterviews;
