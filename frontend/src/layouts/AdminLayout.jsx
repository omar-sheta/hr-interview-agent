import { Box, useTheme } from '@mui/material';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';

const AdminLayout = () => {
    const theme = useTheme();

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: theme.palette.background.default }}>
            <Sidebar />
            <Box sx={{ flexGrow: 1, ml: '280px', p: 4 }}>
                <TopBar />
                <Outlet />
            </Box>
        </Box>
    );
};

export default AdminLayout;
