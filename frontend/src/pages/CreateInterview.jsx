import { useState } from 'react';
import { Box, Stepper, Step, StepLabel, Button, Typography, Paper, TextField, Container } from '@mui/material';
import { useTheme } from '@mui/material/styles';

const steps = ['Job Details', 'Interview Questions', 'Assign & Schedule'];

const CreateInterview = () => {
    const [activeStep, setActiveStep] = useState(0);
    const theme = useTheme();

    const handleNext = () => {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
    };

    const handleBack = () => {
        setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };

    return (
        <Container maxWidth="lg">
            <Box sx={{ width: '100%', mt: 4 }}>
                <Typography variant="h4" fontWeight="800" sx={{ mb: 4 }}>
                    Define New Interview
                </Typography>

                <Stepper activeStep={activeStep} sx={{ mb: 5 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                <Paper sx={{ p: 4, mb: 4, borderRadius: 3 }}>
                    {activeStep === 0 && (
                        <Box>
                            <Typography variant="h6" gutterBottom>Job Details</Typography>
                            <TextField fullWidth label="Job Role" placeholder="e.g., Senior Frontend Developer" sx={{ mb: 3 }} />
                            <TextField fullWidth multiline rows={4} label="Job Description" placeholder="Paste the job description here..." />
                        </Box>
                    )}
                    {activeStep === 1 && (
                        <Typography>Step 2: Interview Questions (Coming Soon)</Typography>
                    )}
                    {activeStep === 2 && (
                        <Typography>Step 3: Assign & Schedule (Coming Soon)</Typography>
                    )}
                </Paper>

                <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
                    <Button
                        color="inherit"
                        disabled={activeStep === 0}
                        onClick={handleBack}
                        sx={{ mr: 1 }}
                    >
                        Back
                    </Button>
                    <Box sx={{ flex: '1 1 auto' }} />
                    <Button onClick={handleNext} variant="contained">
                        {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
                    </Button>
                </Box>
            </Box>
        </Container>
    );
};

export default CreateInterview;
