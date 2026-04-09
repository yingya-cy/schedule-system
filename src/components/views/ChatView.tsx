import React from 'react';
import { 
  Search, 
  Bell, 
  Phone, 
  Video, 
  MoreVertical, 
  Smile, 
  Paperclip, 
  Image as ImageIcon, 
  History, 
  Send,
  Download,
  FileText,
  School
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

const conversations = [
  {
    id: '1',
    name: '计算神经科学研讨',
    lastMessage: '李教授：这份文献值得一看...',
    time: '14:20',
    unread: 3,
    active: true,
    avatar: 'https://picsum.photos/seed/group1/100/100',
  },
  {
    id: '2',
    name: '2024届毕业生课题组',
    lastMessage: '陈美：大家记得提交开题报告。',
    time: '昨天',
    unread: 0,
    avatar: 'https://picsum.photos/seed/group2/100/100',
  },
  {
    id: '3',
    name: '学术讲座通报群',
    lastMessage: '[链接] 关于人工智能伦理的讲座',
    time: '周一',
    unread: 0,
    icon: <School size={20} className="text-secondary" />,
    isSystem: true,
  },
];

const onlineMembers = [
  { name: '李教授', role: '导师', avatar: 'https://picsum.photos/seed/prof/100/100', status: 'online' },
  { name: '王若冰', role: '正在输入...', avatar: 'https://picsum.photos/seed/student1/100/100', status: 'typing' },
  { name: '张三 (我)', role: '在线', avatar: 'https://picsum.photos/seed/me/100/100', status: 'online' },
];

export default function ChatView() {
  return (
    <div className="flex h-[calc(100vh-128px)] gap-6">
      {/* Left Sidebar: Conversations */}
      <div className="w-80 flex flex-col gap-4">
        <div className="bg-surface-container-low rounded-xl p-2 flex gap-1">
          <button className="flex-1 py-2 text-xs font-semibold bg-white text-primary rounded-lg shadow-sm">群聊</button>
          <button className="flex-1 py-2 text-xs font-medium text-on-surface-variant hover:bg-white/50 rounded-lg transition-colors">私聊</button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
          {conversations.map((chat) => (
            <div 
              key={chat.id}
              className={cn(
                "p-4 rounded-xl flex gap-3 cursor-pointer transition-all duration-200",
                chat.active 
                  ? "bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-l-4 border-primary" 
                  : "hover:bg-surface-container-low"
              )}
            >
              <div className="relative w-12 h-12 shrink-0">
                {chat.isSystem ? (
                  <div className="w-full h-full bg-surface-container-high flex items-center justify-center rounded-lg">
                    {chat.icon}
                  </div>
                ) : (
                  <img className="w-full h-full rounded-lg object-cover" src={chat.avatar} alt={chat.name} />
                )}
                {chat.unread > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-[10px] text-on-primary flex items-center justify-center rounded-full border-2 border-white font-bold">
                    {chat.unread}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className="font-bold text-sm truncate text-on-surface font-headline">{chat.name}</h3>
                  <span className="text-[10px] text-outline">{chat.time}</span>
                </div>
                <p className={cn(
                  "text-xs truncate",
                  chat.active ? "text-primary font-medium" : "text-on-surface-variant"
                )}>{chat.lastMessage}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Window */}
      <div className="flex-1 flex flex-col bg-surface-container-lowest rounded-2xl shadow-[0_8px_40px_rgb(0,0,0,0.03)] overflow-hidden border border-surface-container-high/30">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-surface-container-low flex justify-between items-center bg-white/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden">
              <img className="w-full h-full object-cover" src="https://picsum.photos/seed/group-header/100/100" alt="group" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface font-headline">计算神经科学研讨 (12)</h2>
              <p className="text-[10px] text-primary flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
                4 人在线
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-outline hover:text-primary transition-colors"><Phone size={18} /></button>
            <button className="p-2 text-outline hover:text-primary transition-colors"><Video size={18} /></button>
            <button className="p-2 text-outline hover:text-primary transition-colors"><MoreVertical size={18} /></button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-surface/30 scrollbar-hide">
          <div className="flex justify-center">
            <span className="px-3 py-1 bg-surface-container text-[10px] text-outline rounded-full font-label">14:00</span>
          </div>

          {/* Message Received */}
          <div className="flex gap-3 max-w-[80%]">
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
              <img className="w-full h-full object-cover" src="https://picsum.photos/seed/student-r/100/100" alt="user" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-outline ml-1">王若冰 · 博士生</span>
              <div className="bg-white border border-surface-container-high p-3 rounded-xl rounded-tl-none shadow-sm text-sm text-on-surface leading-relaxed">
                大家好，我已经把这周讨论的神经动力学模型源码上传到仓库了。
              </div>
            </div>
          </div>

          {/* Message Sent */}
          <div className="flex flex-row-reverse gap-3 max-w-[80%] ml-auto">
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
              <img className="w-full h-full object-cover" src="https://picsum.photos/seed/me-chat/100/100" alt="me" />
            </div>
            <div className="space-y-1 text-right">
              <span className="text-[10px] text-outline mr-1">我</span>
              <div className="bg-primary text-on-primary p-3 rounded-xl rounded-tr-none shadow-md shadow-primary/10 text-sm leading-relaxed">
                收到，我下午测试一下参数灵敏度。
              </div>
            </div>
          </div>

          {/* Message Received with File */}
          <div className="flex gap-3 max-w-[80%]">
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
              <img className="w-full h-full object-cover" src="https://picsum.photos/seed/prof-chat/100/100" alt="prof" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-outline ml-1">李教授</span>
              <div className="bg-white border border-surface-container-high p-3 rounded-xl rounded-tl-none shadow-sm text-sm text-on-surface leading-relaxed">
                <div className="flex items-center gap-3 p-2 bg-surface-container-low rounded-lg mb-2 border border-surface-container-high/50">
                  <FileText className="text-primary" size={20} />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-bold truncate">Neural_Dynamics_Ref.pdf</p>
                    <p className="text-[10px] text-outline">4.2 MB · PDF文件</p>
                  </div>
                  <Download className="text-outline cursor-pointer hover:text-primary" size={16} />
                </div>
                这份文献值得一看，尤其是第三章关于 Hopf 分岔的讨论。
              </div>
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-surface-container-low">
          <div className="flex items-center gap-2 mb-3">
            <button className="p-1.5 text-outline hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"><Smile size={20} /></button>
            <button className="p-1.5 text-outline hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"><Paperclip size={20} /></button>
            <button className="p-1.5 text-outline hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"><ImageIcon size={20} /></button>
            <div className="h-4 w-[1px] bg-surface-container mx-1"></div>
            <button className="p-1.5 text-outline hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"><History size={20} /></button>
          </div>
          <div className="flex items-end gap-4">
            <div className="flex-1 min-h-[44px] bg-surface-container-low rounded-xl px-4 py-3 border border-transparent focus-within:border-primary/20 focus-within:bg-white transition-all">
              <textarea 
                className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm resize-none leading-relaxed" 
                placeholder="输入消息..." 
                rows={1}
              />
            </div>
            <button className="h-[44px] px-6 bg-primary text-on-primary text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
              <span>发送</span>
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar: Members */}
      <div className="w-64 hidden xl:flex flex-col gap-6">
        <div className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-surface-container-high/30">
          <h3 className="text-xs font-bold text-outline uppercase tracking-widest mb-4">在线成员 (4)</h3>
          <div className="space-y-4">
            {onlineMembers.map((member) => (
              <div key={member.name} className="flex items-center gap-3">
                <div className="relative">
                  <img className="w-8 h-8 rounded-lg object-cover" src={member.avatar} alt={member.name} />
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white",
                    member.status === 'online' ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                  )}></div>
                </div>
                <div>
                  <p className="text-xs font-bold text-on-surface">{member.name}</p>
                  <p className={cn(
                    "text-[10px]",
                    member.status === 'online' ? "text-primary" : "text-outline"
                  )}>{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100/30">
          <h3 className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-3">公告栏</h3>
          <div className="space-y-3">
            <div className="p-3 bg-white/60 rounded-xl border border-white">
              <p className="text-[11px] font-bold text-primary mb-1">课题组会议</p>
              <p className="text-[10px] text-primary/70 leading-relaxed">本周五下午2点于302会议室进行模型中期汇报，请准时参加。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
