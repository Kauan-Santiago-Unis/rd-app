import { NavigationContainer } from "@react-navigation/native";
import { ThemeProvider } from "./src/Contexts/ThemeContext";
import { SyncProvider } from "./src/Contexts/SyncContext";
import UserContextProvider from "./src/Contexts/UserContext";
import MainStack from "./src/Stacks/MainStack";
import { navigationRef } from "./src/utils/navigation";

export default function App() {
  return (
    <UserContextProvider>
      <ThemeProvider>
        <SyncProvider>
          <NavigationContainer ref={navigationRef}>
            <MainStack />
          </NavigationContainer>
        </SyncProvider>
      </ThemeProvider>
    </UserContextProvider>
  );
}
