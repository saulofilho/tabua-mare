import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCw, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class TacticalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('TacticalErrorBoundary interceptou um erro:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      const isDynamicImportError =
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('Importing a module script failed');

      return (
        <div className="p-6 border-2 border-black dark:border-white bg-[#f8f7f4] dark:bg-[#161b22] font-mono text-xs my-4 shadow-[3px_3px_0px_#d42020]">
          <div className="flex items-center gap-2 text-[#d42020] font-bold text-sm uppercase mb-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{this.props.fallbackTitle || 'Falha de Carregamento de Módulo Náutico'}</span>
          </div>

          <p className="text-[#555] dark:text-[#aaa] mb-4 leading-relaxed">
            {isDynamicImportError
              ? 'Houve uma instabilidade temporária na conexão ao sincronizar o módulo sob demanda. Clique no botão abaixo para restabelecer a conexão.'
              : `Ocorreu uma exceção inesperada durante a renderização deste componente: ${this.state.error?.message || 'Erro desconhecido'}`}
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-black hover:bg-[#333] text-white dark:bg-white dark:text-black dark:hover:bg-[#eee] font-bold uppercase cursor-pointer transition-colors flex items-center gap-2 shadow-[2px_2px_0px_#000]"
            >
              <RotateCw className="w-4 h-4" />
              <span>TENTAR NOVAMENTE</span>
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-2 border-2 border-black dark:border-white bg-white hover:bg-[#eee] dark:bg-[#21262d] dark:hover:bg-[#30363d] text-black dark:text-white font-bold uppercase cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>RECARREGAR APLICAÇÃO</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default TacticalErrorBoundary;
