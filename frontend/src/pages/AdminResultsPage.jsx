import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Container,
  Typography,
  Button,
  Box,
  Chip,
  Grid,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
} from '@mui/material';
import {
  ExpandMore,
  CheckCircleOutline,
  HighlightOff,
  StarBorder,
  ThumbUpOutlined,
  Search,
  Delete,
  Visibility,
} from '@mui/icons-material';

const AdminResultsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupBy, setGroupBy] = useState('interview'); // 'interview' | 'user'
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [resultToDelete, setResultToDelete] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const loadResults = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError('');
      const params = { admin_id: user.user_id };
      const { data } = await api.get('/api/admin/results', { params });
      setResults(data.results || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to fetch results');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
  }, [user]);

  const filteredResults = results.filter((r) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (r.interview_title || '').toLowerCase().includes(query) ||
      (r.candidate_username || '').toLowerCase().includes(query) ||
      (r.candidate_id || '').toLowerCase().includes(query)
    );
  });

  const groupedResults = (filteredResults || []).reduce((acc, r) => {
    const key = groupBy === 'interview' ? (r.interview_title || 'Unknown Interview') : (r.candidate_username || r.candidate_id || 'Unknown Candidate');
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const groups = Object.keys(groupedResults).sort().map((title) => ({ title, results: groupedResults[title] }));

  const handleAccept = async (sessionId) => {
    if (!user) return;
    try {
      const { data } = await api.post(`/api/admin/results/${sessionId}/accept`, null, {
        params: { admin_id: user.user_id },
      });
      setResults((prevResults) =>
        prevResults.map((r) => (r.session_id === sessionId ? { ...r, status: 'accepted' } : r))
      );
      setSnackbar({
        open: true,
        message: data.email_sent
          ? '✅ Candidate accepted and email sent!'
          : '✅ Candidate accepted (email not sent)',
        severity: data.email_sent ? 'success' : 'warning',
      });
    } catch (err) {
      console.error('Failed to accept:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to accept candidate',
        severity: 'error',
      });
    }
  };

  const handleReject = async (sessionId) => {
    if (!user) return;
    try {
      const { data } = await api.post(`/api/admin/results/${sessionId}/reject`, null, {
        params: { admin_id: user.user_id },
      });
      setResults((prevResults) =>
        prevResults.map((r) => (r.session_id === sessionId ? { ...r, status: 'rejected' } : r))
      );
      setSnackbar({
        open: true,
        message: data.email_sent
          ? '✅ Candidate rejected and email sent!'
          : '✅ Candidate rejected (email not sent)',
        severity: data.email_sent ? 'success' : 'warning',
      });
    } catch (err) {
      console.error('Failed to reject:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to reject candidate',
        severity: 'error',
      });
    }
  };

  const handleDeleteClick = (result) => {
    setResultToDelete(result);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!resultToDelete) return;
    try {
      await api.delete(`/api/admin/results/${resultToDelete.session_id}`, {
        params: { admin_id: user.user_id },
      });
      await loadResults();
      setDeleteConfirmOpen(false);
      setResultToDelete(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete result');
      setDeleteConfirmOpen(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false);
    setResultToDelete(null);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'accepted': return 'success';
      case 'rejected': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getScoreColor = (score) => {
    if (!score) return 'text.secondary';
    if (score >= 8) return 'success.main';
    if (score >= 5) return 'warning.main';
    return 'error.main';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="800" sx={{ mb: 1 }}>
          Interview Results
        </Typography>
        <Typography variant="body1" color="text.secondary">
          View and manage all candidate assessments.
        </Typography>
      </Box>

      {/* Search & Filters */}
      <Box sx={{ mb: 4, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: 'center' }}>
        <TextField
          fullWidth
          placeholder="Search by candidate name, interview title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search color="action" />
              </InputAdornment>
            ),
          }}
          sx={{ bgcolor: 'background.paper', borderRadius: 2 }}
        />
        <Box sx={{ display: 'flex', gap: 2, minWidth: 'fit-content' }}>
          <Button variant="outlined" endIcon={<ExpandMore />} sx={{ textTransform: 'none', color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper' }}>
            Status: All
          </Button>
          <Button variant="outlined" endIcon={<ExpandMore />} sx={{ textTransform: 'none', color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper' }}>
            Date Range
          </Button>
          <Button variant="outlined" endIcon={<ExpandMore />} sx={{ textTransform: 'none', color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper' }}>
            Score Range
          </Button>
        </Box>
      </Box>

      {loading && <CircularProgress />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Results Table */}
      {!loading && (
        <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
          <TableContainer>
            <Table stickyHeader aria-label="sticky table">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'background.default' }}>CANDIDATE NAME</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'background.default' }}>INTERVIEW TITLE</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'background.default' }}>OVERALL SCORE</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'background.default' }}>STATUS</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'background.default' }}>DATE COMPLETED</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'background.default' }} align="right"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredResults.map((result) => (
                  <TableRow hover role="checkbox" tabIndex={-1} key={result.session_id} sx={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/results/${result.session_id}`)}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src={result.candidate_avatar} sx={{ width: 32, height: 32 }}>{result.candidate_username?.[0]}</Avatar>
                        <Typography fontWeight="500">{result.candidate_username || 'Unknown'}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{result.interview_title}</TableCell>
                    <TableCell>
                      <Typography fontWeight="600" sx={{ color: getScoreColor(result.overall_score || result.scores?.overall) }}>
                        {(typeof result.overall_score === 'number' || typeof result.scores?.overall === 'number')
                          ? `${(result.overall_score ?? result.scores?.overall).toFixed(1)}/10`
                          : 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={result.status || 'Pending'}
                        color={getStatusColor(result.status)}
                        size="small"
                        sx={{ fontWeight: 500, borderRadius: 1 }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {result.created_at ? new Date(result.created_at).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/results/${result.session_id}`);
                        }}
                      >
                        View Details
                      </Button>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(result);
                        }}
                        sx={{ ml: 1 }}
                      >
                        <Delete />
                      </IconButton>

                    </TableCell>
                  </TableRow>
                ))}
                {filteredResults.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No results found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {/* Pagination Placeholder */}
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary">
              Showing <Box component="span" fontWeight="bold">1</Box> to <Box component="span" fontWeight="bold">{filteredResults.length}</Box> of <Box component="span" fontWeight="bold">{filteredResults.length}</Box> results
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" size="small" disabled>Previous</Button>
              <Button variant="outlined" size="small" disabled>Next</Button>
            </Box>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default AdminResultsPage;
