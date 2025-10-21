import { Stack } from 'expo-router';

export default function PropertiesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{
          title: 'Properties',
        }}
      />
      <Stack.Screen 
        name="add" 
        options={{
          title: 'Add Property',
          presentation: 'modal',
        }}
      />
      <Stack.Screen 
        name="[id]" 
        options={{
          title: 'Property Details',
        }}
      />
    </Stack>
  );
}