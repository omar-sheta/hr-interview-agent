import { useEffect, useState } from 'react';
import { Box, Grid, Typography, Card, CardContent, CardActions, Button, Chip, CircularProgress, Alert, Divider, alpha, useTheme } from '@mui/material';
import { Edit, PlayArrow, Pause, Group, Delete, Add } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { motion } from 'framer-motion';

const AdminInterviews = () => {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const theme = useTheme();

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

  const handleToggleActive = async (interview) => {
    await api.put(`/api/admin/interviews/${interview.id}`, {
      admin_id: user.user_id,
      active: !interview.active,
    });
    await loadInterviews();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this interview?')) {
      try {
        await api.delete(`/api/admin/interviews/${id}`, {
          params: { admin_id: user.user_id },
        });
        await loadInterviews();
      } catch (err) {
        console.error(err);
      }
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
                <Button size="small" startIcon={<Edit />} sx={{ fontWeight: 600 }}>Edit</Button>
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
    </motion.div>
  );
};

export default AdminInterviews;
