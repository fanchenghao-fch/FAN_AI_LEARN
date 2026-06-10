import { PropsWithChildren } from "react";
import { useLaunch } from "@tarojs/taro";
import "./app.scss";

function App({ children }: PropsWithChildren<object>) {
  useLaunch(() => {
    console.log("AI Quiz Platform launched.");
  });

  // children is the page component provided by Taro router
  return children;
}

export default App;
