import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Container } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';

const InterviewSuccessPage = () => {
    const navigate = useNavigate();

    return (
        <Box
            sx={{
                minHeight: '100vh',
                bgcolor: '#FAFAFA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    py: 2,
                    px: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    bgcolor: 'white',
                    borderBottom: '1px solid #E5E7EB',
                }}
            >
                <Box
                    sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        bgcolor: '#007BFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Box
                        sx={{
                            width: 0,
                            height: 0,
                            borderLeft: '4px solid transparent',
                            borderRight: '4px solid transparent',
                            borderBottom: '7px solid white',
                            transform: 'rotate(180deg)',
                        }}
                    />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
                    Hive Internship Interview
                </Typography>
            </Box>

            {/* Success Card */}
            <Container maxWidth="sm">
                <Box
                    sx={{
                        bgcolor: 'white',
                        borderRadius: 3,
                        p: { xs: 4, sm: 6 },
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
                        textAlign: 'center',
                    }}
                >
                    {/* Success Icon */}
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            bgcolor: 'rgba(59, 130, 246, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mx: 'auto',
                            mb: 3,
                        }}
                    >
                        <CheckCircle sx={{ fontSize: 48, color: '#3B82F6' }} />
                    </Box>

                    {/* Success Message */}
                    <Typography
                        variant="h4"
                        sx={{
                            fontWeight: 700,
                            color: '#111827',
                            mb: 2,
                        }}
                    >
                        Submission Successful!
                    </Typography>

                    <Typography
                        variant="body1"
                        sx={{
                            color: '#6B7280',
                            lineHeight: 1.6,
                            mb: 4,
                        }}
                    >
                        Thank you for completing the interview. Your results have been sent
                        to the hiring team and they will be in touch regarding the next steps.
                    </Typography>

                    {/* Back Button */}
                    <Button
                        variant="contained"
                        size="large"
                        onClick={() => navigate('/candidate-dashboard')}
                        sx={{
                            bgcolor: '#3B82F6',
                            color: 'white',
                            px: 4,
                            py: 1.5,
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '1rem',
                            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
                            '&:hover': {
                                bgcolor: '#2563EB',
                            },
                        }}
                    >
                        Back to Candidate Dashboard
                    </Button>
                </Box>
            </Container>
        </Box>
    );
};

export default InterviewSuccessPage;
