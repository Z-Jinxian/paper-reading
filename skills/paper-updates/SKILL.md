---
name: paper-updates
description: 每天完成每日推荐与最新技术各一篇，维护三个独立领域论文库。
---

# 远端论文推荐

## 每日上午的选读与维护

- 每次以北京时间当天为复核日，滚动计算半年和一年窗口。遵循 /skills/paper-screening/SKILL.md 与 /skills/paper-reading/SKILL.md。把大模型、自动驾驶、具身智能作为三个并列主方向，每轮都分别检索；Physical AI 只补充无人机、工业自动化、人机协作、闭环世界模型与 sim-to-real 等交叉方向，不替代三个主方向。跨运行查重并适当轮换方向。
- 每日精读先查所读版本的授权声明及许可原文。核验允许本站转载与翻译时，优先按页码／行范围取完整关键英文段，逐段保存 original、summary（忠实中译）、analysis（技术讲解）。在 source.note 注明作者、所读论文版本、许可名称、许可原文 URL 及翻译说明。许可范围不明时，保留原文定位，使用自撰英中释义，必要时附合规短引。
- 时效只决定检索窗口，不给论文额外加分。本周新作和半年前工作在同一证据标准下竞争；发布日期仅在其他条件接近时作为同分项。不要因为“刚发布”、机构宣传或榜单名次直接入选。
- 每轮先形成跨领域候选池，通常至少六篇；大模型、自动驾驶、具身智能各至少两篇达到基本证据门槛的候选，再保留三至五篇短名单，尽量三类都有。某一类近半年不足时，只对该类扩到近一年并解释；仍不足则明确记录缺口。比较它们能否改变具体实验决策、对照是否公平、正式发表层级、公开实现、独立复现或后续采用，以及结论能否迁移到实际研发。最终入选按全局质量竞争，领域轮换只能用于质量相近的候选，不得为了凑齐方向降标准。
- 每轮为「每日推荐」新增一篇。优先在近半年选择证据最强、长期阅读价值最高的一篇；半年内没有达标候选时扩到一年并逐篇解释。首发、正式发表和阅读版本分别记录。新建专题逐步积累覆盖不同问题的三篇首读，历史专题内容持续保留。

## 入选门槛与排序

- 公开可读且通过 /skills/paper-screening/SKILL.md 的权威性硬门槛才可推荐：权威公司官方论文／技术报告，或已由权威顶会正式录用／发表。重点核验 Tesla、DeepSeek、OpenAI、Anthropic、Qwen、小米、地平线等公司官方来源。公司预印本须标明未核实会议录用；普通 arXiv 预印本不可仅凭实验强或背景贴合入选。逐篇记录通过路线和官方证据。
- 用户已删除 DreamFree（2611.04527）和 NEO-VLA（2611.06918），未经用户重新授权不得自动重新推荐或入库。

- 先过门槛再排序。候选至少要有可定位的核心机制、关键对照和实际实验数字，并能回答“读完会改变哪个实验或实现选择”。只有摘要、演示视频、机构宣传或作者自述时不进入每日推荐。
- 按以下顺序判断：实验决策影响与长期价值；原文证据和对照质量；正式发表层级；独立复现、采用或后续工作；与已有专题的互补性。时效仅作同分项。
- 刚发布且尚无独立证据的论文，先满足权威性硬门槛，再核验受控实验和实现细节。否则先放候选观察，不抢占每日推荐。
- 回看「每日阅读」中 JustRUA、Kimi K3、OmniDreams 的标准：论文应提供可迁移的技术判断、能拆开的实验变量和明确边界。新推荐至少达到这一层次；没有达标论文时如实报告，不为完成一轮而降低门槛。
- 通过 Sites get_site 获取本网站的最新服务访问凭据，仅向同一站发送 OAI-Sites-Authorization Bearer 头。凭据只放进进程内存和标准输入，不写入文件、日志或提示词。所有 API 请求加 x-notebook-request 为 1。不需要访客身份或模型配置。
- GET /api/library 返回 {papers, topics}。先查 DOI、arXiv ID、标题及来源链接，重试时复用同一记录与 revision，避免重复。GET 本 Skill 和另外两个 Skill 获取现行规则。
- 主专题使用 topics 中最契合的 ID，确需新专题时 POST /api/topics，JSON 为 {name}，使用返回 ID。PUT /api/papers/user-<UUID> 使用 multipart/form-data，字段 revision 为 0，note 为 JSON。更新已有记录时使用其 ID 与最新 revision。409 时重新读取并合并，保留原笔记和上传文件。
- note 基本字段为 title, category, additionalCategories（其他板块ID数组）, venue, reason, tags, thesis, source {landing,pdf,version,note}, sections, formulas, example {title,setup,steps,takeaway}, limits。sections 含 heading, background, why, passageNotes, details, asset, alt, page。每条 passageNotes 按来源顺序保存 page/from/to、original（可使用的原文）或 english（自撰英文释义）、summary（与此段对应的中译或中文释义）及 analysis（该段重要性、机制和证据）。formulas 含 name,original,latex,symbols 二元组数组,steps,scope,principle,numericExample,asset 空字符串,alt,page,afterPassage（该章节第几段后插入，1起始）。original须含§归属节号。页码须从同一版 PDF 核实。已知缺口写入 limits，不编造截图和数字。
- note.recommendation 为 {date:北京时间 YYYY-MM-DD, importance:0到100, evidence:筛选和排序理由}。评分使用同一量尺：实验决策影响 30、证据与对照质量 25、正式发表权威性 15、独立采用／复现 15、长期阅读价值 10、与现有专题互补性 5。时效不计分。只有作者自报结果、尚无正式记录和独立证据的预印本原则上不超过 84；正式顶会且对照扎实但尚缺独立采用通常为 85–91；92 以上需要奖项、独立复现、广泛采用或同等级证据。回看最近三篇和「每日阅读」三篇校准分数。date 只在首次推荐时设置，重试和精读补充保留原日期。
- recommendation.evidence 同时写入：候选池规模、进入短名单的论文、主要落选原因、入选论文改变的实验决策，以及仍缺少的独立证据。不得只写入选论文的优点。
- 一条记录同时显示于每日推荐和主专题。首页自动选择最近三篇推荐，再按 importance 降序排列，同分按日期降序。旧推荐退出首页展示后保留专题记录。无需删除论文或每轮重新部署。
- 保存后 GET /api/library 回读 ID、revision、专题和 recommendation，再 GET 首页验证每日推荐恰好三篇且顺序正确。网络失败先读回确认是否已提交。简要报告论文、证据、写入与验证结果，失败清楚标明。

## 领域论文库与半年覆盖

- 每天北京时间 09:00 执行。先按北京时间日期检查已入库的 recommendation.date，当日已有推荐时继续维护精选与范式，复用当天记录。每日最多新增一条推荐标记。首页始终展示最近三条活跃推荐并按重要度排序。
- 每条推荐保存时就挂到大模型、具身智能与机器人、自动驾驶中的一个或多个归档板块，必要时再挂方法专题。离开三篇推荐或半年窗口后继续保留原来的领域条目与精读。
- GET /api/library 的 frontier 提供 today、start、models、robotics、driving 和 technologies，分别检查大模型、具身智能与机器人、自动驾驶三个列表，按论文 ID 去重计数。models 至少十篇，robotics 与 driving 的去重并集至少十篇，分别报告各领域的覆盖量。embodied 是供旧接口调用者使用的并集。领域收录通过 category 和 additionalCategories 关联；大模型用 large-models，具身智能与机器人用 embodied-robotics，自动驾驶使用 topics 中“自动驾驶”的实际 ID。
- 优先以近半年的首次公开或正式会议／期刊日期为核验时间，会议录用、修订和卷宗补录须注明。新增精选均写 note.frontier={date,firstPublic,lesson,evidence}。date 是正式发表日或初次公开日，支持 YYYY-MM-DD 和 YYYY-MM（月粒度按月初保守判断）；firstPublic 单列首次公开记录，lesson 给出可实行的实验判断，evidence 包括对照、指标、适用条件与一手出处。经典与一年扩窗论文可保留在归档，不计入半年保底。
- 逐日检查未来七天将出窗的条目；提前补入有质量的候选，让现有覆盖量留有余量。可一次补入多条精选导读，只有当天推荐的那篇附 recommendation。优先复用现有论文与精读；所有合格新作也可跨组、跨专题展示。删除标记继续生效。
- 最新技术任务按 /skills/technology-updates/SKILL.md 独立执行，每轮从泛 AI 技术进展中另外选读一篇。使用 technologyRecommendation 计数和查重，当天两个任务选择不同论文。
- 新证据可在对应论文写入 note.paradigm={name,meaning,change,evidence,limit,source,date}。同名沿用稳定名称；date 是证据日期，source 是 HTTPS 一手来源。证据栏保留关键早期对照及新结果。最新版自动显示于「最新技术」，原论文仍在档。没有实质新证据时保留原条目。
- 写入后回读验证当天唯一推荐、首页恰好三篇、models 至少十篇、robotics 与 driving 去重并集至少十篇且全部在窗，检查领域归档与技术原文链接。若写入失败，先读取最新 revision 再补全。
- 未指定专题的通用前沿进入大模型、具身智能与机器人或自动驾驶板块，也可同时保留技术专题。查重后复用同一论文ID，以additionalCategories增加展示位置；不新建重复实体，不因新增展示位置重设推荐日期。按当日读者要做的技术判断选择关键段落。沿原文顺序完成每段英文、对应中文、重要技术解释，再就地放公式、同组数字手算及可检验的预测。重大突破说明此前瓶颈、作者的新选择、决定性对照与尚缺的证据；架构或损失重要时，用一条样本走过中间量，分别检查训练梯度和推理数据流。

- 首页沿用推荐卡片，大模型（large-models）、具身智能与机器人（embodied-robotics）、自动驾驶（按 topics 中实际 ID）各自独立展示。每个领域只有一个板块，半年窗口通过 frontier 数据维护，复用领域内的同一条记录。
- 所有新增领域论文保存 readingImportance（0–100），使用与 recommendation.importance 相同的证据量尺。领域内按 readingImportance 降序，缺省时复用 recommendation.importance 或已有编辑排序；同分再看推荐日期。评分表达站内编辑判断，重试与补充精读保留原评分，确有新证据才调整。
- 首页验证每个领域只显示一个板块、同一板块内论文 ID 唯一且按阅读价值降序。方法专题可交叉收录。

## 同一云端任务的两个选读记录

- 每次依次完成每日推荐与最新技术选读。先分别检查 recommendation.date 和 technologyRecommendation.date，已完成的部分复用当天记录，继续未完成部分。
- 最新技术任务读取 /skills/technology-updates/SKILL.md，覆盖泛 AI 的架构、训练、推理、智能体、多模态、数据、系统、AI 科学与交叉技术。每轮以不同候选完成独立选文、精读、写入和回读。
- 每日推荐沿用三领域候选池和滚动三篇展示。最新技术使用完整 paradigm 与独立技术标记，首页显示代表论文的精读链接。
