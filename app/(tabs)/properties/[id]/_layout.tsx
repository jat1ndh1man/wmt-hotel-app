import { Stack } from 'expo-router';

export default function PropertyDetailLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{
          title: 'Property Details',
        }}
      />
      <Stack.Screen 
        name="rooms" 
        options={{
          title: 'Room Management',
        }}
      />
    </Stack>
  );
}