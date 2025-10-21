import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ImageBackground,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { supabase } from '../../lib/supabaseClient';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const backgroundImages = [
  require('../../assets/images/hotel1.jpg'),
  require('../../assets/images/hotel2.jpg'),
  require('../../assets/images/hotel3.jpg'),
  require('../../assets/images/hotel4.jpg'),
  require('../../assets/images/hotel5.jpg'),
];

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [emailSent, setEmailSent] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [formData, setFormData] = useState({
    email: '',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Background slideshow effect
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setCurrentImageIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: 'hotelapp://reset-password', // Deep link for mobile
      });

      if (error) {
        throw error;
      }

      setEmailSent(true);
      Toast.show({
        type: 'success',
        text1: 'Reset Email Sent!',
        text2: 'Check your email inbox for the reset link.',
      });
    } catch (error: any) {
      console.error('Password reset error:', error);

      let errorMessage = 'An error occurred while sending reset email';

      if (error.message?.includes('User not found')) {
        errorMessage = 'No account found with this email address';
      } else if (error.message?.includes('Email rate limit exceeded')) {
        errorMessage = 'Too many requests. Please wait before trying again';
      } else if (error.message?.includes('Invalid email')) {
        errorMessage = 'Please enter a valid email address';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setErrors({ general: errorMessage });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!formData.email || !validateEmail(formData.email)) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: 'hotelapp://reset-password',
      });

      if (error) {
        throw error;
      }

      Toast.show({
        type: 'success',
        text1: 'Email Resent!',
        text2: 'Check your inbox for the reset link.',
      });
    } catch (error: any) {
      console.error('Resend email error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to resend email. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderForm = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Reset Your Password</Text>
        <Text style={styles.cardDescription}>
          Enter your email to receive reset instructions
        </Text>
      </View>

      <View style={styles.cardContent}>
        {/* Error Alert */}
        {errors.general && (
          <View style={styles.alertError}>
            <Ionicons name="alert-circle" size={20} color="#FF3B30" />
            <Text style={styles.alertText}>{errors.general}</Text>
          </View>
        )}

        {/* Email Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputWithIcon}>
            <Ionicons name="mail-outline" size={18} color="#999" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.inputWithIconPadding, errors.email && styles.inputError]}
              value={formData.email}
              onChangeText={(text) => handleInputChange('email', text)}
              placeholder="Enter your email address"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
              autoFocus
            />
          </View>
          {errors.email && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color="#FF3B30" />
              <Text style={styles.errorText}>{errors.email}</Text>
            </View>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#007AFF', '#0051D5']}
            style={styles.gradientButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isLoading ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.buttonText}>Sending Reset Link...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <Ionicons name="send-outline" size={20} color="#fff" />
                <Text style={styles.buttonText}>Send Reset Link</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Back to Login */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={16} color="#007AFF" />
          <Text style={styles.backButtonText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmailSent = () => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        {/* Success Icon */}
        <View style={styles.successIconContainer}>
          <Ionicons name="checkmark-circle" size={60} color="#34C759" />
        </View>

        <Text style={styles.successTitle}>Reset Email Sent!</Text>
        <Text style={styles.successSubtitle}>
          Check your email inbox and click the reset link to create a new password.
        </Text>

        {/* Email Display */}
        <View style={styles.emailDisplay}>
          <Text style={styles.emailLabel}>Reset email sent to:</Text>
          <Text style={styles.emailValue}>{formData.email}</Text>
        </View>

        {/* Instructions */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>What's next?</Text>
            <Text style={styles.infoItem}>• Check your email inbox for the reset link</Text>
            <Text style={styles.infoItem}>• Click the link to create a new password</Text>
            <Text style={styles.infoItem}>• If you don't see the email, check your spam folder</Text>
            <Text style={styles.infoItem}>• The reset link will expire in 1 hour</Text>
          </View>
        </View>

        {/* Resend Button */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleResendEmail}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator color="#007AFF" size="small" />
              <Text style={styles.secondaryButtonText}>Resending...</Text>
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons name="send-outline" size={20} color="#007AFF" />
              <Text style={styles.secondaryButtonText}>Resend Email</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Back to Login */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push('/(auth)/login')}
        >
          <Ionicons name="arrow-back" size={16} color="#007AFF" />
          <Text style={styles.backButtonText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View style={[styles.backgroundContainer, { opacity: fadeAnim }]}>
        <ImageBackground
          source={backgroundImages[currentImageIndex]}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <View style={styles.overlay} />
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,58,143,0.2)']}
            style={styles.gradientOverlay}
          />
        </ImageBackground>
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../assets/images/LOGO1.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </View>
          <Text style={styles.headerTitle}>Forgot Password</Text>
          <Text style={styles.headerSubtitle}>
            {emailSent ? 'Check your email' : 'Reset your password to access your account'}
          </Text>
        </View>

        {emailSent ? renderEmailSent() : renderForm()}

        {/* Additional Help */}
        <View style={styles.helpSection}>
          <Text style={styles.helpText}>
            Still having trouble?{' '}
            <Text style={styles.helpLink}>Contact Support</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoWrapper: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#E5E5EA',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 5,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  cardHeader: {
    padding: 20,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  cardContent: {
    padding: 24,
  },
  alertError: {
    flexDirection: 'row',
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    color: '#991B1B',
    marginLeft: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A3A3C',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#C6C6C8',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  inputWithIcon: {
    position: 'relative',
  },
  inputWithIconPadding: {
    paddingLeft: 45,
  },
  inputIcon: {
    position: 'absolute',
    left: 15,
    top: 15,
    zIndex: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginLeft: 4,
  },
  submitButton: {
    marginBottom: 16,
    borderRadius: 10,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  gradientButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  backButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 6,
    fontWeight: '500',
  },
  successIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    alignSelf: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  emailDisplay: {
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
  },
  emailLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  emailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
    marginBottom: 8,
  },
  infoItem: {
    fontSize: 12,
    color: '#1976D2',
    marginBottom: 4,
    lineHeight: 18,
  },
  secondaryButton: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  helpSection: {
    marginTop: 24,
    alignItems: 'center',
  },
  helpText: {
    fontSize: 12,
    color: '#E5E5EA',
  },
  helpLink: {
    color: '#007AFF',
    fontWeight: '600',
  },
});