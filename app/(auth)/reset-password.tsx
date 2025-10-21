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

type FormData = {
  password: string;
  confirmPassword: string;
};

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [formData, setFormData] = useState<FormData>({
    password: '',
    confirmPassword: '',
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

  // Check if the user has a valid reset session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session check error:', sessionError);
          setIsValidSession(false);
          setErrors({ 
            general: 'No valid reset session found. Please request a new reset link.' 
          });
        } else if (session) {
          setIsValidSession(true);
        } else {
          setIsValidSession(false);
          setErrors({ 
            general: 'No valid reset session found. Please request a new reset link.' 
          });
        }
      } catch (error) {
        console.error('Session validation error:', error);
        setErrors({ general: 'An error occurred while validating the reset link.' });
        setIsValidSession(false);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  const validatePassword = (password: string): { isValid: boolean; message?: string } => {
    if (password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters long' };
    }

    if (!/(?=.*[a-z])/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }

    if (!/(?=.*\d)/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one number' };
    }

    return { isValid: true };
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        newErrors.password = passwordValidation.message!;
      }
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      const { error } = await supabase.auth.updateUser({
        password: formData.password,
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      Toast.show({
        type: 'success',
        text1: 'Password Updated Successfully!',
        text2: 'You can now sign in with your new password.',
      });

      // Redirect to login after success
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 2000);
    } catch (error: any) {
      console.error('Password reset error:', error);

      let errorMessage = 'An error occurred while updating your password';

      if (error.message?.includes('New password should be different')) {
        errorMessage = 'New password must be different from your current password';
      } else if (error.message?.includes('Password should be at least')) {
        errorMessage = 'Password does not meet security requirements';
      } else if (error.message?.includes('Token has expired')) {
        errorMessage = 'Reset link has expired. Please request a new one';
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

  // Loading state while checking session
  if (checkingSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Verifying reset link...</Text>
      </View>
    );
  }

  // Invalid session state
  if (!isValidSession) {
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
          </ImageBackground>
        </Animated.View>

        <View style={styles.errorContainer}>
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <View style={styles.errorIconContainer}>
                <Ionicons name="close-circle" size={60} color="#FF3B30" />
              </View>

              <Text style={styles.errorTitle}>Invalid or Expired Link</Text>
              <Text style={styles.errorSubtitle}>
                This password reset link is no longer valid. Please request a new one.
              </Text>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={() => router.push('/(auth)/forgot-password')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#007AFF', '#0051D5']}
                  style={styles.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.buttonText}>Request New Reset Link</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.push('/(auth)/login')}
              >
                <Ionicons name="arrow-back" size={16} color="#007AFF" />
                <Text style={styles.backButtonText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

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
          <Text style={styles.headerTitle}>Reset Password</Text>
          <Text style={styles.headerSubtitle}>
            Create a new password for your account
          </Text>
        </View>

        {/* Reset Password Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Create New Password</Text>
            <Text style={styles.cardDescription}>
              Enter your new password to complete the reset
            </Text>
          </View>

          <View style={styles.cardContent}>
            {/* Success Alert */}
            {success && (
              <View style={styles.alertSuccess}>
                <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                <View style={styles.alertTextContainer}>
                  <Text style={styles.alertSuccessTitle}>Password updated successfully!</Text>
                  <Text style={styles.alertSuccessText}>Redirecting to sign in page...</Text>
                </View>
              </View>
            )}

            {/* Error Alert */}
            {errors.general && (
              <View style={styles.alertError}>
                <Ionicons name="alert-circle" size={20} color="#FF3B30" />
                <Text style={styles.alertText}>{errors.general}</Text>
              </View>
            )}

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color="#999"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    styles.inputWithIconPadding,
                    errors.password && styles.inputError,
                  ]}
                  value={formData.password}
                  onChangeText={(text) => handleInputChange('password', text)}
                  placeholder="Enter your new password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  editable={!isLoading && !success}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isLoading || success}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#999"
                  />
                </TouchableOpacity>
              </View>
              {errors.password && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={14} color="#FF3B30" />
                  <Text style={styles.errorText}>{errors.password}</Text>
                </View>
              )}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color="#999"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    styles.inputWithIconPadding,
                    errors.confirmPassword && styles.inputError,
                  ]}
                  value={formData.confirmPassword}
                  onChangeText={(text) => handleInputChange('confirmPassword', text)}
                  placeholder="Confirm your new password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showConfirmPassword}
                  editable={!isLoading && !success}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading || success}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#999"
                  />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={14} color="#FF3B30" />
                  <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                </View>
              )}
            </View>

            {/* Password Requirements */}
            <View style={styles.requirementsBox}>
              <Text style={styles.requirementsTitle}>Password Requirements:</Text>
              <View style={styles.requirementItem}>
                <View
                  style={[
                    styles.requirementDot,
                    formData.password.length >= 8 && styles.requirementDotActive,
                  ]}
                />
                <Text style={styles.requirementText}>At least 8 characters long</Text>
              </View>
              <View style={styles.requirementItem}>
                <View
                  style={[
                    styles.requirementDot,
                    /(?=.*[a-z])/.test(formData.password) && styles.requirementDotActive,
                  ]}
                />
                <Text style={styles.requirementText}>One lowercase letter</Text>
              </View>
              <View style={styles.requirementItem}>
                <View
                  style={[
                    styles.requirementDot,
                    /(?=.*[A-Z])/.test(formData.password) && styles.requirementDotActive,
                  ]}
                />
                <Text style={styles.requirementText}>One uppercase letter</Text>
              </View>
              <View style={styles.requirementItem}>
                <View
                  style={[
                    styles.requirementDot,
                    /(?=.*\d)/.test(formData.password) && styles.requirementDotActive,
                  ]}
                />
                <Text style={styles.requirementText}>One number</Text>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, (isLoading || success) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading || success}
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
                    <Text style={styles.buttonText}>Updating Password...</Text>
                  </View>
                ) : success ? (
                  <View style={styles.buttonContent}>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Password Updated!</Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>Update Password</Text>
                )}
              </LinearGradient>
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

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Your password is protected with advanced encryption
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  alertSuccess: {
    flexDirection: 'row',
    backgroundColor: '#D1FAE5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  alertTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  alertSuccessTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 2,
  },
  alertSuccessText: {
    fontSize: 13,
    color: '#047857',
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
    paddingRight: 45,
  },
  inputIcon: {
    position: 'absolute',
    left: 15,
    top: 15,
    zIndex: 1,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 14,
    padding: 5,
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
  requirementsBox: {
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  requirementsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3A3A3C',
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requirementDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C6C6C8',
    marginRight: 8,
  },
  requirementDotActive: {
    backgroundColor: '#34C759',
  },
  requirementText: {
    fontSize: 12,
    color: '#8E8E93',
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
  errorIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    alignSelf: 'center',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorSubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#E5E5EA',
  },
});