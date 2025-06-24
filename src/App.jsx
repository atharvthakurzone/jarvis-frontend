import React, { useState, useEffect } from 'react';

const models = [
  { id: "jarvis-custom", name: "Jarvis (Personal AI)" },
  { id: "mistralai/mistral-7b-instruct", name: "Mistral 7B Instruct" },
  { id: "huggingfaceh4/zephyr-7b-beta", name: "Zephyr 7B Beta" },
  { id: "openai/gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  { id: "meta-llama/llama-2-70b-chat", name: "LLaMA 2 70B Chat" },
  { id: "google/gemma-7b-it", name: "Gemma 7B It" }
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

  useEffect(() => {
    localStorage.setItem("jarvisMemory", JSON.stringify(jarvisMemory));
  }, [jarvisMemory]);

  const handleSubmit = async (msg = input) => {
    if (!msg.trim()) return;

    const abortCtrl = new AbortController();
    setController(abortCtrl);

    const userMsg = { role: "user", content: msg };
    setChatHistory(prev => [...prev, userMsg]);
    setInput("");

    const memoryContext = jarvisMemory.map(entry => `${entry.q}\n${entry.a}`).join('\n');
    const combinedQuery = `${memoryContext}\n${msg}`.trim();

    try {
      const response = await fetch("https://jarvis-backend-rbev.onrender.com/api/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: combinedQuery,
          model: selectedModel === "jarvis-custom" ? "openai/gpt-3.5-turbo" : selectedModel
        }),
        signal: abortCtrl.signal
      });

      const data = await response.json();
      const jarvisMsg = { role: "jarvis", content: data.reply };
      setChatHistory(prev => [...prev, jarvisMsg]);
      setJarvisMemory(prev => [...prev, { q: msg, a: data.reply }]);

      if (speakMode) {
        const utterance = new SpeechSynthesisUtterance(data.reply);
        speechSynthesis.speak(utterance);
      }

      setSpeakMode(false);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log("Fetch aborted");
      } else {
        console.error("Error:", err);
      }
    }
  };

  const handleStop = () => {
    if (controller) controller.abort();
    speechSynthesis.cancel();
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

    recognition.onend = () => {
      console.log("Voice input ended");
    };
  };

  return (
    <div className="flex h-screen">
      <div className="w-64 bg-gray-800 p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-white">Chats</h2>
        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`mb-2 ${msg.role === "user" ? "text-blue-400" : "text-green-400"}`}>
            <strong>{msg.role === "user" ? "You" : "Jarvis"}:</strong> {msg.content}
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex p-4 bg-gray-700 items-center">
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

        <div className="flex-1 p-4 overflow-y-auto">
          {chatHistory.map((msg, idx) => (
            <div key={idx} className={`mb-2 ${msg.role === "user" ? "text-blue-400" : "text-green-400"}`}>
              <strong>{msg.role === "user" ? "You" : "Jarvis"}:</strong> {msg.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
