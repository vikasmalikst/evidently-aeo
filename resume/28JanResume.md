%-------------------------
% Resume in Latex
% Author : Jake Gutierrez
% Based off of: https://github.com/sb2nov/resume
% License : MIT
%------------------------

\documentclass[letterpaper,11pt]{article}

\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\usepackage{fontawesome5}
\usepackage{multicol}
\setlength{\multicolsep}{-3.0pt}
\setlength{\columnsep}{-1pt}
\input{glyphtounicode}


%----------FONT OPTIONS----------
% sans-serif
% \usepackage[sfdefault]{FiraSans}
% \usepackage[sfdefault]{roboto}
% \usepackage[sfdefault]{noto-sans}
% \usepackage[default]{sourcesanspro}

% serif
% \usepackage{CormorantGaramond}
% \usepackage{charter}


\pagestyle{fancy}
\fancyhf{} % clear all header and footer fields
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

% Adjust margins
\addtolength{\oddsidemargin}{-0.6in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1.19in}
\addtolength{\topmargin}{-.7in}
\addtolength{\textheight}{1.4in}

\urlstyle{same}

\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

% Sections formatting
\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large\bfseries
}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]

% Ensure that generate pdf is machine readable/ATS parsable
\pdfgentounicode=1

%-------------------------
% Custom commands
\newcommand{\resumeItem}[1]{
  \item\small{
    {#1 \vspace{-2pt}}
  }
}

\newcommand{\classesList}[4]{
    \item\small{
      {#1 #2 #3 #4 \vspace{-2pt}}
  }
}

\newcommand{\resumeSubheading}[4]{
  \vspace{-2pt}\item
    \begin{tabular*}{1.0\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & \textbf{\small #2} \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubSubheading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \textit{\small#1} & \textit{\small #2} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{1.001\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & \textbf{\small #2}\\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubItem}[1]{\resumeItem{#1}\vspace{-4pt}}

\renewcommand\labelitemi{$\vcenter{\hbox{\tiny$\bullet$}}$}
\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.0in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%


\begin{document}

%----------HEADING----------
\begin{center}
    {\Huge \scshape Avaya Sharma} \\ \vspace{1pt}
    New Delhi, Delhi, India \\ \vspace{1pt}
    \small \raisebox{-0.1\height}\faPhone\  9667731024 ~ \href{mailto:avaya.sharma933@gmail.com}{\raisebox{-0.2\height}\faEnvelope\  \underline{avaya.sharma933@gmail.com}} ~  
    \href{https://linkedin.com/in/avaya-sharma-30a244226}{\raisebox{-0.2\height}\faLinkedin\ \underline{linkedin.com/in/avaya-sharma}}  ~
    \href{https://github.com/Avaya02}{\raisebox{-0.2\height}\faGithub\ \underline{github.com/Avaya02}}
    \vspace{-8pt}
\end{center}


%-----------EDUCATION-----------
\section{Education}
  \resumeSubHeadingListStart
    \resumeSubheading
      {Dronacharya Group Of Institutions}{Greater Noida, UP}
      {Bachelor of Technology in Computer Science}{2020 -- 2024}
      \resumeSubheading
      {DAV Centenary Public School}{Ghaziabad, UP}
      {PCM(Class XII)}{2020}
  \resumeSubHeadingListEnd


%-----------EXPERIENCE-----------
\section{Experience}
  \resumeSubHeadingListStart
    \resumeSubheading
      {Anvaya Labs}{October 2025 -- Present}
      {Full Stack Engineer}{Remote}
      \resumeItemListStart
      
        \resumeItem{Architected and developed \href{https://evidentlyaeo.com/}{\textcolor{blue}{\textbf{Evidently AEO}}}, a B2B SaaS platform for AI Search Optimization, from scratch using the \textbf{PERN stack} (PostgreSQL, Express, React, Node.js) and TypeScript, enabling enterprise brands to monitor visibility across Perplexity, Gemini, and ChatGPT.}

        \resumeItem{Engineered a proprietary \textbf{Hybrid Visibility Scoring engine} that fuses \textbf{Generative AI} with deterministic statistical algorithms, solving LLM hallucination in analytics and achieving \textbf{99\% data reproducibility} from unstructured search results.}
        \resumeItem{Designed a scalable \textbf{Data Intake Pipeline} utilizing \textbf{Puppeteer} for automated SERP scraping and intelligent \textbf{Job Scheduling} to process thousands of concurrent queries, optimized with a complex \textbf{PostgreSQL} schema using \textbf{JSONB} for flexible data storage.}
        \resumeItem{Automated actionable insights generation by creating a \textbf{Recommendation Engine} that uses \textbf{RAG} principles and \textbf{Graph Algorithms (PageRank, Louvain)} to analyze negative brand sentiment and suggest content improvements for marketing teams.}
      \resumeItemListEnd
    \resumeSubheading
      {Eastern Software Solutions}{October 2024 -- October 2025}
      {Software Engineer}{Noida}
      \resumeItemListStart
        \resumeItem{Engineered backend procedures with \textbf{PL/SQL} to automate data ingestion and transformation, providing structured, clean data for business intelligence and Power BI dashboards.}
        \resumeItem{Collaborated with cross-functional teams to deliver secure, responsive, and intuitive web applications, resulting in a 15\% increase in client satisfaction and operational efficiency.}
         \resumeItem{Utilized the MERN stack (MongoDB, Express.js, React, Node.js) to build and maintain robust full-stack applications, ensuring scalability and performance.}
      \resumeItemListEnd
      
  \resumeSubHeadingListEnd

%-----------PROJECTS-----------
\section{Projects}
    \vspace{-5pt}
    \resumeSubHeadingListStart
      \resumeProjectHeading
          {\href{https://app.thinklytixai.com/auth}{\textbf{ThinkLytix.AI}} | \emph{Express.js, React.js, Node.js, MySQL, Prisma, Next.js, Gemini AI}} {}
          \resumeItemListStart
            \resumeItem{\href{https://thinklytixai.com/}{\textcolor{blue}{\textbf{Live Website}}} | \href{https://app.thinklytixai.com/auth}{\textcolor{blue}{\textbf{Live Product}}}}
            \resumeItem{Engineered a two-part system, consisting of a public-facing website and a secure AI-powered application, for the \textbf{supply chain} industry.}
            \resumeItem{Developed the public-facing marketing website using \textbf{Next.js} and \textbf{TypeScript}, while building the core application with a custom full-stack architecture, which includes a secure authentication system.}
            \resumeItem{Integrated the \textbf{Gemini AI API} to enable real-time analysis, designed to achieve high prediction accuracy and empower clients to make faster, data-driven decisions.}
            \resumeItem{Designed and implemented an intuitive and responsive user interface, enhancing the user experience for complex AI interactions and data visualization.}
          \resumeItemListEnd
          \vspace{-13pt}
      
      \resumeProjectHeading
          {\href{https://study-notion-mocha-xi.vercel.app}{\textbf{StudyNotion}} $|$ \emph{MongoDB, Express.js, React.js, Node.js, Tailwind CSS}} {}
          \resumeItemListStart
            \resumeItem{Built a responsive and fully functional \textbf{Ed-tech} platform  that enables \textbf{ users} to seamlessly create, consume and rate educational content with proper \textbf{authentication} and \textbf{authorization}.}
            \resumeItem{Integrated \textbf{Razorpay} payment method, providing a secure and convenient payment solution for course enrollment and instructor earnings.}
            \resumeItem{Employed \textbf{Mongoose} for data modeling, schema validation, and seamless interaction between \textbf{MongoDB} and the application.}
          \resumeItemListEnd 
    \resumeSubHeadingListEnd
\vspace{-10pt}


%-----------PROGRAMMING SKILLS-----------
\section{Technical Skills}
 \begin{itemize}[leftmargin=0.15in, label={}]
    \small{\item{
     \textbf{Languages}{: Java, JavaScript, TypeScript, SQL, PLSQL } \\
     \textbf{Technologies/Frameworks}{: React.js, Express.js, Node.js, Redux, Next.js, Tailwind CSS, HTML} \\
     \textbf{Database}{: PostgreSQL, MySQL, MongoDB, Supabase } \\
     \textbf{Developer Tools}{: VS Code, Git/GitHub, Postman, Vercel, Figma, N8N} \\
    }}
 \end{itemize}
 \vspace{-16pt}


%-----------CERTIFICATIONS-----------
\section{Certifications}
    \resumeItemListStart
      \item {\href{paste link here}{\textbf{Data Structures and Algorithms in Java (Basic to Advanced)}}}
        { -- Coding Blocks (Pitampura)}
      \item {\href{paste link here}{\textbf{Web Development Bootcamp (MERN Stack)}}}
        { -- Codehelp by Love Babbar}
    \resumeItemListEnd

\end{document}