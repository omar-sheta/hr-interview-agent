import { Box, IconButton, InputBase, Button, Badge, Avatar, useTheme, alpha } from '@mui/material';
import { Search, Notifications, Add } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const TopBar = () => {
    const theme = useTheme();
    const navigate = useNavigate();

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 4,
                gap: 2,
            }}
        >
            {/* Search Bar */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    bgcolor: alpha(theme.palette.background.paper, 0.1), // Slightly transparent
                    borderRadius: 2,
                    px: 2,
                    py: 1,
                    width: '40%',
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
            >
                <Search sx={{ color: 'text.secondary', mr: 1 }} />
                <InputBase
                    placeholder="Search candidates, roles..."
                    sx={{ width: '100%' }}
                />
            </Box>

            {/* Actions */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => navigate('/admin/interviews/create')}
                    sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        boxShadow: '0 4px 14px 0 rgba(0,118,255,0.39)',
                        background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                    }}
                >
                    Create New Interview
                </Button>

                <IconButton sx={{ bgcolor: alpha(theme.palette.background.paper, 0.1), borderRadius: 2 }}>
                    <Badge color="error" variant="dot">
                        <Notifications />
                    </Badge>
                </IconButton>

                <Avatar
                    src="https://i.pravatar.cc/150?img=12"
                    sx={{ width: 40, height: 40, border: `2px solid ${theme.palette.background.paper}` }}
                />
            </Box>
        </Box>
    );
};

export default TopBar;
