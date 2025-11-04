import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

export const resetTo = (name, params) => {
  if (!navigationRef.isReady()) return false;
  navigationRef.reset({
    index: 0,
    routes: [{ name, params }],
  });
  return true;
};

export const navigate = (name, params) => {
  if (!navigationRef.isReady()) return false;
  navigationRef.navigate(name, params);
  return true;
};

export const goBack = () => {
  if (!navigationRef.isReady() || !navigationRef.canGoBack()) return false;
  navigationRef.goBack();
  return true;
};
