import { Card, CardContent, Typography, Box, List, ListItem, ListItemAvatar, Avatar, ListItemText, Chip, Button, useTheme, alpha } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const CandidatePipeline = ({ candidates = [] }) => {
    const theme = useTheme();
    const navigate = useNavigate();

    const getStatusColor = (status) => {
        switch (status) {
            case 'AI Screening': return 'info';
            case 'Awaiting Review': return 'warning';
            case 'Scheduled': return 'success';
            case 'active': return 'success';
            case 'candidate': return 'info';
            default: return 'default';
        }
    };

    const getStatusLabel = (candidate) => {
        // If candidate has a status field, use it
        if (candidate.status) return candidate.status;
        // Otherwise show role
        return candidate.role === 'candidate' ? 'Active' : candidate.role;
    };

    return (
        <Card
            sx={{
                height: '100%',
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                backgroundColor: alpha(theme.palette.background.paper, 0.6),
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
        >
            <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" fontWeight="700">
                        Candidate Pipeline
                    </Typography>
                    <Button
                        size="small"
                        sx={{ fontWeight: 600 }}
                        onClick={() => navigate('/admin/candidates')}
                    >
                        View All
                    </Button>
                </Box>

                <List disablePadding>
                    {candidates.slice(0, 4).map((candidate, index) => (
                        <ListItem key={candidate.id || index} sx={{ px: 0, py: 1.5 }}>
                            <ListItemAvatar>
                                <Avatar src={candidate.avatar_url} alt={candidate.username}>
                                    {candidate.username?.[0]?.toUpperCase()}
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary={<Typography fontWeight="600">{candidate.username}</Typography>}
                                secondary={candidate.email}
                            />
                            <Chip
                                label={getStatusLabel(candidate)}
                                color={getStatusColor(candidate.status || candidate.role)}
                                size="small"
                                sx={{ fontWeight: 600, borderRadius: 1.5 }}
                            />
                        </ListItem>
                    ))}
                    {candidates.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                            No candidates found
                        </Typography>
                    )}
                </List>
            </CardContent>
        </Card>
    );
};

export default CandidatePipeline;
