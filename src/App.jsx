import React, { useState, useEffect, useRef } from 'react';

const models = [
  { id: "jarvis-custom", name: "Jarvis (Personal AI)" },
  { id: "mistralai/mistral-7b-instruct", name: "Mistral 7B Instruct" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" }
];

const App = () => {
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [jarvisMemory, setJarvisMemory] = useState(() => {
    const saved = localStorage.getItem("jarvisMemory");
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedModel, setSelectedModel] = useState(models[0].id);
  const [controller, setController] = useState(null);
  const [speakMode, setSpeakMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("jarvisMemory", JSON.stringify(jarvisMemory));
  }, [jarvisMemory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isLoading]);

  const getModelNameById = (id) => {
    const model = models.find(m => m.id === id);
    return model ? model.name : id;
  };

  const handleSubmit = async (msg = input) => {
    if (!msg.trim()) return;

    const abortCtrl = new AbortController();
    setController(abortCtrl);
    setIsLoading(true);

    const userMsg = {
      role: "user",
      content: msg,
      model: getModelNameById(selectedModel)
    };
    setChatHistory(prev => [...prev, userMsg]);
    setInput("");

    const memoryContext = selectedModel === "jarvis-custom"
      ? jarvisMemory.map(entry => `${entry.q}\n${entry.a}`).join('\n')
      : "";

    let replyContent = "";
    const replyMsg = {
      role: "assistant",
      content: "",
      model: getModelNameById(selectedModel)
    };
    setChatHistory(prev => [...prev, replyMsg]);
    const replyIndex = chatHistory.length + 1;

    try {
      const response = await fetch("https://jarvis-backend-rbev.onrender.com/api/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: msg,
          model: selectedModel,
          memoryContext
        }),
        signal: abortCtrl.signal
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        replyContent += chunk;

        setChatHistory(prev => {
          const updated = [...prev];
          updated[replyIndex] = {
            ...updated[replyIndex],
            content: replyContent
          };
          return updated;
        });
      }

      if (selectedModel === "jarvis-custom") {
        setJarvisMemory(prev => {
          const updated = [...prev, { q: msg, a: replyContent }];
          return updated.slice(-200);
        });
      }

      if (speakMode) {
        const utterance = new SpeechSynthesisUtterance(replyContent);
        speechSynthesis.speak(utterance);
      }

      setSpeakMode(false);
      setIsLoading(false);

    } catch (err) {
      setIsLoading(false);
      if (err.name !== 'AbortError') {
        console.error("Error:", err);
      }
    }
  };

  const handleStop = () => {
    if (controller) controller.abort();
    speechSynthesis.cancel();
    setIsLoading(false);
  };

  const handleVoiceInput = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSpeakMode(true);
      handleSubmit(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
    };
  };

  return (
    <div className="flex h-screen">
      <div className="w-64 bg-gray-800 p-4 flex flex-col">
  <h2 className="text-2xl font-extrabold text-white mb-4 text-center">Jarvis</h2>

  <button
    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mb-4"
    onClick={() => setChatHistory([])}
  >
    + New Chat
  </button>

  <div className="flex-1 overflow-y-auto space-y-2">
    {chatHistory.map((msg, idx) => (
      msg.role === "user" && (
        <div
          key={idx}
          className="bg-gray-700 text-white p-2 rounded cursor-pointer hover:bg-gray-600"
        >
          Chat {idx + 1}
        </div>
      )
    ))}
  </div>
</div>

      <div className="flex-1 flex flex-col">
        {/* Chat Area */}
        <div className="flex-1 p-4 overflow-y-auto">
          {chatHistory.map((msg, idx) => (
            <div key={idx} className={`mb-2 ${msg.role === "user" ? "text-blue-400" : "text-green-400"}`}>
              <strong>{msg.role === "user" ? "You" : msg.model}:</strong> {msg.content}
            </div>
          ))}
          {isLoading && <div className="text-gray-400 italic">Jarvis is thinking...</div>}
          <div ref={messagesEndRef}></div>
        </div>

        {/* Typing Panel (moved to bottom) */}
        <div className="flex p-4 bg-gray-700 items-center border-t border-gray-600">
          <select
            className="bg-gray-900 text-white p-2 rounded mr-2"
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
          >
            {models.map(model => (
              <option key={model.id} value={model.id}>{model.name}</option>
            ))}
          </select>
          <input
            className="flex-1 p-2 rounded bg-gray-800 text-white mr-2"
            placeholder="Type your command..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          <button className="bg-blue-500 px-4 py-2 rounded" onClick={() => handleSubmit()}>
            Send
          </button>
          <button className="bg-yellow-500 px-4 py-2 rounded ml-2" onClick={handleVoiceInput}>
            🎤 Speak
          </button>
          <button className="bg-red-500 px-4 py-2 rounded ml-2" onClick={handleStop}>
            Stop
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
