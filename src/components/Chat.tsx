import { useState, useEffect, useRef, type FormEvent, type MouseEvent, type ReactElement } from 'react';
import '../styles/App.scss';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

type Role = 'assistant' | 'user';

type Source = {
    link: string;
    source: string;
};

type Message = {
    role: Role;
    content: string;
    sources?: Source[];
};

type HistoryItem = {
    id: string;
    date: string;
};

const initialAssistantMessage: Message = {
    role: 'assistant',
    content: 'Hello! I am your news assistant. Ask me anything about the latest news.',
};

const Chat = (): ReactElement => {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const storedHistory: HistoryItem[] = JSON.parse(localStorage.getItem('chat_history_list') || '[]');
        setHistoryList(storedHistory);

        const initSession = async () => {
            try {
                const storedSession = localStorage.getItem('chat_session_id');
                if (storedSession) {
                    setSessionId(storedSession);
                    fetchHistory(storedSession);
                } else {
                    createSession();
                }
            } catch (error) {
                console.error('Error initializing session:', error);
            }
        };
        initSession();
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const createSession = async () => {
        try {
            const res = await fetch(`${API_URL}/session`, { method: 'POST' });
            const data: { sessionId: string } = await res.json();
            const newSessionId = data.sessionId;

            setSessionId(newSessionId);
            localStorage.setItem('chat_session_id', newSessionId);
            setMessages([initialAssistantMessage]);

            const newHistoryItem: HistoryItem = { id: newSessionId, date: new Date().toLocaleString() };
            setHistoryList((prev) => {
                const updatedList = [newHistoryItem, ...prev];
                localStorage.setItem('chat_history_list', JSON.stringify(updatedList));
                return updatedList;
            });
        } catch (error) {
            console.error('Error creating session:', error);
        }
    };

    const fetchHistory = async (id: string) => {
        try {
            const res = await fetch(`${API_URL}/history/${id}`);
            const data: { history?: Message[] } = await res.json();
            if (data.history && data.history.length > 0) {
                setMessages(data.history);
            } else {
                setMessages([initialAssistantMessage]);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        }
    };

    const handleNewChat = () => {
        createSession();
    };

    const handleLoadSession = (id: string) => {
        if (id === sessionId) return;
        setSessionId(id);
        localStorage.setItem('chat_session_id', id);
        fetchHistory(id);
    };

    const handleDeleteSession = async (e: MouseEvent<HTMLButtonElement>, id: string) => {
        e.stopPropagation();

        if (historyList.length <= 1) {
            alert("You cannot delete the last active session. Please create a new chat first.");
            return;
        }

        if (window.confirm("Are you sure you want to delete this chat?")) {
            try {
                await fetch(`${API_URL}/session/${id}`, { method: 'DELETE' });

                const updatedList = historyList.filter(item => item.id !== id);
                setHistoryList(updatedList);
                localStorage.setItem('chat_history_list', JSON.stringify(updatedList));

                if (id === sessionId) {
                    const nextSession = updatedList[0];
                    if (nextSession) {
                        handleLoadSession(nextSession.id);
                    } else {
                        setSessionId(null);
                        setMessages([initialAssistantMessage]);
                        localStorage.removeItem('chat_session_id');
                    }
                }
            } catch (error) {
                console.error('Error deleting session:', error);
            }
        }
    };

    const handleResetChat = async () => {
        if (!sessionId) return;

        if (window.confirm("Are you sure you want to clear this chat's history? This will delete all messages in the current conversation.")) {
            try {
                await fetch(`${API_URL}/session/${sessionId}`, { method: 'DELETE' });

                setMessages([initialAssistantMessage]);
            } catch (error) {
                console.error('Error resetting chat:', error);
            }
        }
    };

    const sendMessage = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch(`${API_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, message: input })
            });
            const data: { answer?: string; sources?: Source[] } = await res.json();

            setMessages(prev => [
                ...prev,
                data.sources
                    ? {
                        role: 'assistant',
                        content: data.answer || 'No response received.',
                        sources: data.sources
                    }
                    : {
                        role: 'assistant',
                        content: data.answer || 'No response received.',
                    }
            ]);
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="app-container">
            {/* Chats Section on Top */}
            <div className="chats-section">
                <div className="logo-area">
                    <h1>Voosh<span>News Chat Bot</span></h1>
                </div>
                <button className="new-chat-btn" onClick={handleNewChat}>
                    + New Chat
                </button>
            </div>

            {/* Main Chat Area - Centered */}
            <div className="chat-wrapper">
                <header>
                    <h2>News Assistant</h2>
                    <button className="reset-chat-btn" onClick={handleResetChat} title="Clear chat history">
                        🔄 Reset Chat
                    </button>
                </header>

                <div className="messages-area">
                    {messages.map((msg, index) => (
                        <div key={index} className={`message ${msg.role}`}>
                            <div className="content">{msg.content}</div>
                            {msg.sources && msg.sources.length > 0 && (
                                <div className="sources">
                                    <strong>Sources:</strong>
                                    <ul>
                                        {msg.sources.map((source, idx) => (
                                            <li key={idx}>
                                                <a href={source.link} target="_blank" rel="noopener noreferrer">
                                                    {source.source}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && <div className="loading">Thinking...</div>}
                    <div ref={messagesEndRef} />
                </div>

                <form className="input-area" onSubmit={sendMessage}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about the news..."
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading}>Send</button>
                </form>
            </div>
        </div>
    );
};

export default Chat;
