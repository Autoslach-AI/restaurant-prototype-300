with open("components/MerchantDashboard.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# 1. State declarations
state_target = "const [isDeletingConversationLoading, setIsDeletingConversationLoading] = useState(false);"
new_state = """const [isDeletingConversationLoading, setIsDeletingConversationLoading] = useState(false);
  const [draggedConversationId, setDraggedConversationId] = useState<string | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);"""

if state_target not in text:
    raise Exception("state_target not found")
text = text.replace(state_target, new_state, 1)

# 2. Discussions Section (Root Zone Drop)
root_section_target = """{/* Discussions Section */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono tracking-wider text-slate-500 uppercase font-bold px-2 py-1">
                    Discussions
                  </div>"""

root_section_replacement = """{/* Discussions Section */}
                <div
                  className={`space-y-1.5 transition-all p-1 rounded-xl ${
                    isDragOverRoot
                      ? 'bg-[#1B4B4A]/10 border-2 border-dashed border-[#1B4B4A]'
                      : ''
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setIsDragOverRoot(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setIsDragOverRoot(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOverRoot(false);
                    const conversationId = e.dataTransfer.getData('text/plain');
                    if (conversationId) {
                      handleAssignConversationToProject(conversationId, null);
                    }
                  }}
                >
                  <div className="text-[10px] font-mono tracking-wider text-slate-500 uppercase font-bold px-2 py-1 flex items-center justify-between">
                    <span>Discussions</span>
                    {isDragOverRoot && (
                      <span className="text-[9px] text-[#1B4B4A] font-bold lowercase">
                        deposer a la racine
                      </span>
                    )}
                  </div>"""

if root_section_target not in text:
    raise Exception("root_section_target not found")
text = text.replace(root_section_target, root_section_replacement, 1)

# 3. Root conversation item draggable
root_item_old = """                          <div
                            key={conv.id}
                            className={`group flex items-center justify-between p-2 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                              isSelected && !isTrashViewOpen
                                ? 'bg-white border border-[#E5DCD0] text-[#241F1B] shadow-2xs'
                                : 'hover:bg-white/60 text-slate-600'
                            }`}"""

root_item_new = """                          <div
                            key={conv.id}
                            draggable={!isEditingThisConv}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', conv.id);
                              e.dataTransfer.effectAllowed = 'move';
                              setDraggedConversationId(conv.id);
                            }}
                            onDragEnd={() => {
                              setDraggedConversationId(null);
                              setDragOverProjectId(null);
                              setIsDragOverRoot(false);
                            }}
                            className={`group flex items-center justify-between p-2 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                              draggedConversationId === conv.id ? 'opacity-40 ' : ''
                            }${
                              isSelected && !isTrashViewOpen
                                ? 'bg-white border border-[#E5DCD0] text-[#241F1B] shadow-2xs'
                                : 'hover:bg-white/60 text-slate-600'
                            }`}"""

if root_item_old not in text:
    raise Exception("root_item_old not found")
text = text.replace(root_item_old, root_item_new, 1)

# 4. Project folder drop target
project_header_target = """<div className="flex items-center justify-between p-2 rounded-xl text-xs font-semibold bg-white/40 hover:bg-white/80 transition-all">"""

project_header_replacement = """<div
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                              }}
                              onDragEnter={(e) => {
                                e.preventDefault();
                                setDragOverProjectId(proj.id);
                              }}
                              onDragLeave={(e) => {
                                e.preventDefault();
                                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                                if (dragOverProjectId === proj.id) {
                                  setDragOverProjectId(null);
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                setDragOverProjectId(null);
                                const conversationId = e.dataTransfer.getData('text/plain');
                                if (conversationId) {
                                  handleAssignConversationToProject(conversationId, proj.id);
                                }
                              }}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs font-semibold transition-all ${
                                dragOverProjectId === proj.id
                                  ? 'bg-[#1B4B4A]/15 border-2 border-dashed border-[#1B4B4A]'
                                  : 'bg-white/40 hover:bg-white/80'
                              }`}
                            >"""

if project_header_target not in text:
    raise Exception("project_header_target not found")
text = text.replace(project_header_target, project_header_replacement, 1)

# 5. Project child conversation item draggable
child_old = """                                      <div
                                        key={conv.id}
                                        onClick={() => {
                                          if (!isEditingThisConv) {
                                            setSelectedConversationId(conv.id);
                                            setIsTrashViewOpen(false);
                                          }
                                        }}
                                        className={`group p-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                                          isSelected && !isTrashViewOpen
                                            ? 'bg-white text-[#241F1B] border border-[#E5DCD0] font-semibold'
                                            : 'text-slate-600 hover:bg-white/50'
                                        }`}
                                      >"""

child_new = """                                      <div
                                        key={conv.id}
                                        draggable={!isEditingThisConv}
                                        onDragStart={(e) => {
                                          e.dataTransfer.setData('text/plain', conv.id);
                                          e.dataTransfer.effectAllowed = 'move';
                                          setDraggedConversationId(conv.id);
                                        }}
                                        onDragEnd={() => {
                                          setDraggedConversationId(null);
                                          setDragOverProjectId(null);
                                          setIsDragOverRoot(false);
                                        }}
                                        onClick={() => {
                                          if (!isEditingThisConv) {
                                            setSelectedConversationId(conv.id);
                                            setIsTrashViewOpen(false);
                                          }
                                        }}
                                        className={`group p-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                                          draggedConversationId === conv.id ? 'opacity-40 ' : ''
                                        }${
                                          isSelected && !isTrashViewOpen
                                            ? 'bg-white text-[#241F1B] border border-[#E5DCD0] font-semibold'
                                            : 'text-slate-600 hover:bg-white/50'
                                        }`}
                                      >"""

if child_old not in text:
    raise Exception("child_old not found")
text = text.replace(child_old, child_new, 1)

with open("components/MerchantDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(text)

print("Applied DnD successfully!")
