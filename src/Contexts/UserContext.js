import { createContext } from 'react';
export const UserContext = createContext();

export default ({ children }) => {

  return (
    <UserContext.Provider value={{}}>
      {children}
    </UserContext.Provider>
  );
};