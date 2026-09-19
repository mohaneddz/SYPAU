import { Component, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SypauColor, SypauType } from '@/constants/sypau';

type Props = PropsWithChildren<{ label?: string; fallback?: ReactNode }>;
type State = { error: Error | null };

/** Prevents a single screen's render error (e.g. a native module failing to init) from leaving a blank app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', this.props.label ?? '', error);
  }

  reset = () => this.setState({ error: null });

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>{this.state.error.message}</Text>
        <Pressable style={styles.button} onPress={this.reset}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SypauColor.ink,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 14,
  },
  title: {
    ...SypauType.cardTitle,
    color: SypauColor.bone,
  },
  message: {
    ...SypauType.body,
    color: SypauColor.boneMuted,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    backgroundColor: SypauColor.red,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    ...SypauType.label,
    color: SypauColor.bone,
    textTransform: 'uppercase',
  },
});
