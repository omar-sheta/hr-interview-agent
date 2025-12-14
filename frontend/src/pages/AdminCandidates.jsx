import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Avatar, Chip, IconButton, Button, TextField, InputAdornment, useTheme, alpha, CircularProgress, Alert } from '@mui/material';
import { Visibility, Email, Search, FilterList, Add, Delete } from '@mui/icons-material';
import { motion } from 'framer-motion';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

import { useNavigate } from 'react-router-dom';

const AdminCandidates = () => {
    const theme = useTheme();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const loadCandidates = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const { data } = await api.get('/api/admin/candidates', {
                params: { admin_id: user.user_id },
            });
            setCandidates(data.candidates || []);
        } catch (err) {
            setError(err.response?.data?.detail || 'Unable to load candidates');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCandidates();
    }, [user]);

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this candidate? This action cannot be undone.')) {
            try {
                await api.delete(`/api/admin/candidates/${id}`, {
                    params: { admin_id: user.user_id },
                });
                await loadCandidates();
            } catch (err) {
                console.error(err);
                alert('Failed to delete candidate');
            }
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Accepted': return 'success';
            case 'Interviewed': return 'info';
            case 'Pending': return 'warning';
            case 'Rejected': return 'error';
            case 'active': return 'success';
            case 'candidate': return 'info';
            default: return 'default';
        }
    };

    const filteredCandidates = candidates.filter(c =>
        (c.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight="800" sx={{ letterSpacing: '-0.5px' }}>
                    Candidates
                </Typography>
            </Box>


            {loading && <CircularProgress sx={{ mb: 2 }} />}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper
                sx={{
                    p: 3,
                    borderRadius: 4,
                    backdropFilter: 'blur(10px)',
                    backgroundColor: alpha(theme.palette.background.paper, 0.6),
                    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
            >
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                    <TextField
                        placeholder="Search candidates, roles..."
                        variant="outlined"
                        size="small"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        sx={{ flexGrow: 1 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search color="action" />
                                </InputAdornment>
                            ),
                            sx: { borderRadius: 2 }
                        }}
                    />
                    <Button variant="outlined" startIcon={<FilterList />} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                        Filter
                    </Button>
                </Box>

                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Candidate</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Role</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredCandidates.map((candidate) => (
                                <TableRow key={candidate.id} hover>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Avatar src={candidate.avatar_url} alt={candidate.username}>
                                                {candidate.username?.[0]?.toUpperCase()}
                                            </Avatar>
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight="600">{candidate.username}</Typography>
                                                <Typography variant="caption" color="text.secondary">{candidate.email}</Typography>
                                            </Box>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={candidate.status || candidate.role || 'Active'}
                                            color={getStatusColor(candidate.status || candidate.role)}
                                            size="small"
                                            sx={{ fontWeight: 600, borderRadius: 1.5 }}
                                        />
                                    </TableCell>
                                    <TableCell>{candidate.role || 'Candidate'}</TableCell>
                                    <TableCell align="right">
                                        <IconButton size="small" onClick={() => navigate(`/admin/candidates/${candidate.id}`)}>
                                            <Visibility fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" color="error" onClick={() => handleDelete(candidate.id)}><Delete fontSize="small" /></IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredCandidates.length === 0 && !loading && (
                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                                        <Typography color="text.secondary">No candidates found.</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </motion.div>
    );
};

export default AdminCandidates;
