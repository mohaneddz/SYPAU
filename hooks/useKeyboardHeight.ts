import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Height of the on-screen keyboard, 0 when it's down.
 *
 * Under edge-to-edge the window no longer resizes for the keyboard, and
 * KeyboardAvoidingView doesn't reliably give back the space when it closes —
 * the form was left sitting on a dead band after the first keystroke. Reading
 * the keyboard's own events and padding by exactly that much has neither problem.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) =>
      setHeight(event.endCoordinates.height)
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
