import React, { useRef, useState } from 'react';
import { ExternalLink, Paperclip, X } from 'lucide-react';
import { TELEGRAM_HANDLE, TELEGRAM_SUPPORT_URL, type SupportMessage } from '../data/services';

interface SupportModalProps {
  isOpen: boolean;
  uid: string;
  messages: SupportMessage[];
  onClose: () => void;
  onSendMessage: (payload: { issue: string; message: string; image: string | null }) => void;
  onShowToast: (message: string, isError?: boolean) => void;
  onPlaySound: () => void;
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const max = 800;
      let w = img.width;
      let h = img.height;
      if (w > max || h > max) {
        if (w > h) {
          h *= max / w;
          w = max;
        } else {
          w *= max / h;
          h = max;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.src = objectUrl;
  });
}

export function SupportModal({
  isOpen,
  uid,
  messages,
  onClose,
  onSendMessage,
  onShowToast,
  onPlaySound,
}: SupportModalProps) {
  const [issue, setIssue] = useState('Order Issue');
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleSend = async () => {
    onPlaySound();
    const trimmed = text.trim();
    if (!trimmed && !selectedFile) {
      onShowToast('Message ya image do bhai!', true);
      return;
    }

    setSending(true);
    let imageData: string | null = null;
    if (selectedFile) {
      imageData = await compressImage(selectedFile);
    }

    onSendMessage({
      issue,
      message: trimmed || '📷 Image',
      image: imageData,
    });

    setText('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSending(false);
    onShowToast('Sent ✅ Admin reply yahi ayega');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-[16px]"
    >
      <div className="modal-pop-anim bg-white rounded-[22px] p-[20px] w-full max-w-[380px] shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
        <div className="flex justify-between items-center mb-[12px]">
          <h2
            id="support-modal-title"
            className="text-[#3a1d6d] font-extrabold text-[18px] flex items-center gap-2"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#229ED9]" aria-hidden="true">
              <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434z" />
            </svg>
            <span>Support Chat</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Support Chat"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#888888] hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-between text-[12px] text-[#666666] mb-[8px]">
          <span>
            User ID: <strong className="text-[#7c4dff]">{uid}</strong>
          </span>
          <a
            href={TELEGRAM_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#229ED9] font-bold hover:underline"
          >
            {TELEGRAM_HANDLE} <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </div>

        {messages.length > 0 && (
          <div className="max-h-[180px] overflow-y-auto bg-[#f8f5ff] rounded-[12px] p-[10px] mb-[10px] border border-[#ede7ff] space-y-[6px]">
            {messages.map((m) => {
              const isAdmin = m.from === 'Admin';
              return (
                <div
                  key={m.id}
                  className={`px-[10px] py-[8px] rounded-[12px] text-[12px] max-w-[85%] ${
                    isAdmin
                      ? 'bg-[#7c4dff] text-white mr-auto'
                      : 'bg-white text-[#222222] ml-auto border border-[#dddddd]'
                  }`}
                >
                  <div className="text-[10px] font-bold opacity-70">{m.from}</div>
                  <div>{m.message}</div>
                  {m.image && (
                    <img
                      src={m.image}
                      alt="Uploaded support attachment"
                      className="w-full max-w-[160px] rounded-[10px] mt-[6px]"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <label htmlFor="support-issue-select" className="sr-only">
          Select Issue Category
        </label>
        <select
          id="support-issue-select"
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          className="w-full p-[12px] border-2 border-[#e9dffc] rounded-[12px] outline-none text-[14px] text-[#2d1b4e] bg-white focus:border-[#7c4dff]"
        >
          <option value="Order Issue">Order Issue</option>
          <option value="Payment Issue">Payment Issue</option>
          <option value="Balance Not Added">Balance Not Added</option>
          <option value="Other">Other</option>
        </select>

        <label htmlFor="support-message-input" className="sr-only">
          Write your support message
        </label>
        <textarea
          id="support-message-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={selectedFile ? 'Image selected - caption likho...' : 'Apna problem likho...'}
          className="w-full p-[12px] border-2 border-[#e9dffc] rounded-[12px] outline-none mt-[10px] h-[80px] resize-none text-[14px] text-[#2d1b4e] focus:border-[#7c4dff]"
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setSelectedFile(f);
          }}
        />

        <div className="flex gap-[8px] mt-[10px]">
          <button
            type="button"
            onClick={() => {
              onPlaySound();
              fileInputRef.current?.click();
            }}
            className="flex-1 bg-[#ede7ff] text-[#7c4dff] border border-[#d9ccff] p-[12px] rounded-[14px] font-extrabold text-[13px] cursor-pointer inline-flex items-center justify-center gap-1"
          >
            <Paperclip className="w-4 h-4" aria-hidden="true" />
            <span>Image</span>
          </button>

          <button
            type="button"
            disabled={sending}
            onClick={handleSend}
            className="flex-[2] bg-[#7c4dff] text-white border-0 p-[12px] rounded-[14px] font-extrabold text-[14px] cursor-pointer disabled:opacity-60"
          >
            {sending ? 'Sending...' : 'Send 🚀'}
          </button>
        </div>

        <div className="text-center mt-[8px] text-[11px] text-[#999999]">
          Image bhi bhej sakte ho 📸 • Reply lifetime rahega
        </div>
      </div>
    </div>
  );
}
