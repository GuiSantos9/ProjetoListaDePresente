// Importa as funções necessárias do Firebase SDK (versão modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-analytics.js";
import { getFirestore, collection, onSnapshot, doc, runTransaction, FieldValue } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";


// Sua configuração do Firebase (substitua com suas credenciais reais)
const firebaseConfig = {
    apiKey: "AIzaSyB84iRetqiIBm9cnFHzreb0OIE_Z-8SS94",
    authDomain: "listapresentesdaniel.firebaseapp.com",
    projectId: "listapresentesdaniel",
    storageBucket: "listapresentesdaniel.firebasestorage.app",
    messagingSenderId: "527103687928",
    appId: "1:527103687928:web:0702c99cb2ad4142a4cf0d",
    measurementId: "G-K02JJKWPWQ"
};

// Inicializa o Firebase e obtém instâncias do Analytics e Firestore
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); // Opcional: Se você estiver usando o Google Analytics para seu app
const db = getFirestore(app); // Instância do Firestore


// Garante que o DOM (Document Object Model) esteja completamente carregado antes de executar o script
document.addEventListener('DOMContentLoaded', () => {
    // Obtém referências aos elementos HTML
    const presentForm = document.getElementById('presentForm');
    const presentListDiv = document.getElementById('presentList');
    const confirmationMessage = document.getElementById('confirmationMessage');
    const confirmedPresentText = document.getElementById('confirmedPresentText');
    const confirmButton = document.getElementById('confirmButton'); // O botão de confirmar

    // Referência à coleção 'presentes' no Firestore
    const presentesCollection = collection(db, 'presentes');

    // --- Sincronização em Tempo Real com Firestore ---
    // 'onSnapshot' cria um listener que atualiza a lista sempre que houver mudanças no Firestore
    onSnapshot(presentesCollection, (snapshot) => {
        const presents = [];
        // Itera sobre os documentos (presentes) retornados pelo Firestore
        snapshot.forEach(doc => {
            presents.push({ id: doc.id, ...doc.data() }); // Adiciona o ID do documento junto com os dados
        });
        renderPresents(presents); // Renderiza (desenha) os presentes na interface
        checkFormValidity(); // Revalida o formulário após a lista ser atualizada
    }, (error) => {
        // Exibe um erro se houver problemas ao carregar os presentes
        console.error('Erro ao observar mudanças no Firestore:', error);
        presentListDiv.innerHTML = '<p>Erro ao carregar os presentes. Por favor, tente novamente.</p>';
    });

    // --- Função para Renderizar os Presentes na Interface ---
    function renderPresents(presents) {
        presentListDiv.innerHTML = ''; // Limpa o conteúdo atual da lista de presentes

        // Ordena os presentes alfabeticamente para uma exibição consistente
        presents.sort((a, b) => a.nome_presente.localeCompare(b.nome_presente));

        // Cria e adiciona os checkboxes para cada presente vindo do Firestore
        presents.forEach(present => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = 'presente';
            checkbox.value = present.id; // O valor do checkbox será o ID do documento no Firestore
            checkbox.dataset.name = present.nome_presente; // Armazena o nome do presente em um atributo de dados

            const span = document.createElement('span');
            span.textContent = present.nome_presente;

            // Aplica estilos e desabilita se o presente já estiver marcado
            if (present.status === 'marcado') {
                checkbox.disabled = true; // Impede que seja clicado
                checkbox.checked = true; // Marca-o visualmente
                label.classList.add('marked'); // Adiciona classe CSS para estilo de "marcado"
                span.textContent += ` (Marcado por: ${present.marcado_por_nome || 'Alguém'})`; // Exibe quem marcou
            }

            label.appendChild(checkbox);
            label.appendChild(span);
            presentListDiv.appendChild(label);
        });

        // --- Adiciona a Opção "Outros" ---
        const otherOptionLabel = document.createElement('label');
        otherOptionLabel.classList.add('other-option');
        const otherCheckbox = document.createElement('input');
        otherCheckbox.type = 'checkbox';
        otherCheckbox.name = 'presente';
        otherCheckbox.value = 'outros_personalizado'; // Valor para identificar esta opção
        otherCheckbox.id = 'checkboxOther'; // ID para fácil referência

        const otherText = document.createElement('span');
        otherText.textContent = 'Outros: ';

        const otherInputField = document.createElement('input');
        otherInputField.type = 'text';
        otherInputField.id = 'otherPresentName';
        otherInputField.placeholder = 'Qual presente?';
        otherInputField.disabled = true; // Começa desabilitado
        otherInputField.required = false; // Não é obrigatório até ser selecionado

        otherOptionLabel.appendChild(otherCheckbox);
        otherOptionLabel.appendChild(otherText);
        otherOptionLabel.appendChild(otherInputField);
        presentListDiv.appendChild(otherOptionLabel);

        // --- Listener para a Opção "Outros" ---
        // Habilita/desabilita o campo de texto "Outros" e o torna obrigatório
        otherCheckbox.addEventListener('change', () => {
            otherInputField.disabled = !otherCheckbox.checked;
            otherInputField.required = otherCheckbox.checked;
            if (!otherCheckbox.checked) {
                otherInputField.value = ''; // Limpa o campo se desmarcado
            }
            checkFormValidity(); // Revalida o formulário
        });

        // --- Gerenciamento de Seleção Única (para todos os checkboxes) ---
        // Remove listeners antigos para evitar múltiplas execuções
        presentListDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.removeEventListener('change', handleCheckboxChange);
        });
        // Adiciona um novo listener principal ao container da lista
        presentListDiv.addEventListener('change', handleCheckboxChange);

        // --- Listeners para Validação em Tempo Real (Nome e Telefone) ---
        // Adiciona listeners para os campos de nome e telefone para validar o formulário
        document.getElementById('nome').addEventListener('input', checkFormValidity);
        document.getElementById('telefone').addEventListener('input', checkFormValidity);
        // Adiciona listener para o campo de texto "Outros"
        otherInputField.addEventListener('input', checkFormValidity);
    }

    // --- Função para Lidar com a Seleção de Checkboxes (Seleção Única) ---
    function handleCheckboxChange(event) {
        // Verifica se o evento veio de um checkbox de presente
        if (event.target.type === 'checkbox' && event.target.name === 'presente') {
            // Pega todos os checkboxes disponíveis (não desabilitados permanentemente)
            const checkboxes = presentListDiv.querySelectorAll('input[type="checkbox"]:not(:disabled)');
            const otherInputField = document.getElementById('otherPresentName');
            const checkboxOther = document.getElementById('checkboxOther');

            // Garante que apenas um checkbox esteja selecionado por vez
            checkboxes.forEach(cb => {
                if (cb !== event.target) {
                    cb.checked = false; // Desmarca os outros checkboxes
                }
            });

            // Se o checkbox clicado NÃO for a opção "Outros", desmarca e limpa "Outros"
            if (event.target.id !== 'checkboxOther') {
                checkboxOther.checked = false;
                otherInputField.disabled = true;
                otherInputField.required = false;
                otherInputField.value = '';
            }
            checkFormValidity(); // Revalida o formulário após a mudança na seleção
        }
    }

    // --- Função para Verificar a Validade do Formulário ---
    // Esta função habilita/desabilita o botão "Confirmar Escolha"
    function checkFormValidity() {
        const nome = document.getElementById('nome').value.trim();
        const telefone = document.getElementById('telefone').value.trim();
        // Obtém o checkbox que está marcado e não está desabilitado (permanentemente)
        const selectedCheckbox = Array.from(presentListDiv.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)'));
        const otherPresentName = document.getElementById('otherPresentName');

        let isFormValid = false;

        // Condições para o formulário ser válido:
        // 1. Nome e Telefone preenchidos (telefone com no mínimo 10 dígitos)
        // 2. Exatamente um presente selecionado
        if (nome && telefone.length >= 10) {
            if (selectedCheckbox.length === 1) {
                const chosenOption = selectedCheckbox[0];

                if (chosenOption.value === 'outros_personalizado') {
                    // Se "Outros" foi escolhido, o campo de texto deve estar preenchido
                    if (otherPresentName.value.trim() !== '') {
                        isFormValid = true;
                    }
                } else {
                    // Se um presente da lista pré-definida foi escolhido, é válido
                    isFormValid = true;
                }
            }
        }
        // Habilita ou desabilita o botão com base na validade
        confirmButton.disabled = !isFormValid;
    }

    // --- Lidar com o Envio do Formulário ---
    presentForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Impede o comportamento padrão de envio do formulário

        const nome = document.getElementById('nome').value.trim();
        const telefone = document.getElementById('telefone').value.trim();
        // Busca o checkbox marcado que não está desabilitado
        const selectedCheckbox = Array.from(presentListDiv.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)'));
        const otherPresentNameInput = document.getElementById('otherPresentName');

        // Validações adicionais antes de tentar enviar para o Firebase
        if (!nome || !telefone) {
            alert('Por favor, preencha seu nome e telefone.');
            return;
        }
        if (selectedCheckbox.length === 0) {
            alert('Por favor, escolha um presente para marcar.');
            return;
        }
        if (selectedCheckbox.length > 1) { // Prevenção, já que a lógica de seleção única deveria evitar isso
             alert('Por favor, selecione apenas um presente.');
             return;
        }

        const chosenOption = selectedCheckbox[0];
        let presenteId;
        let presenteNome;

        // --- Lógica para Presentes Pré-definidos vs. "Outros" ---
        if (chosenOption.value === 'outros_personalizado') {
            // Se a opção "Outros" foi selecionada
            if (otherPresentNameInput.value.trim() === '') {
                alert('Por favor, digite o nome do presente em "Outros".');
                return;
            }
            presenteNome = otherPresentNameInput.value.trim();
            presenteId = null; // Será um novo documento com ID gerado pelo Firestore
        } else {
            // Se um presente da lista pré-definida foi selecionado
            presenteId = chosenOption.value;
            presenteNome = chosenOption.dataset.name;
        }

        // --- Transação no Firestore para Garantir Atomicidade ---
        // Isso é crucial para evitar que duas pessoas marquem o mesmo presente ao mesmo tempo
        try {
            await runTransaction(db, async (transaction) => {
                let docRef;
                let presentData = {};

                if (presenteId) {
                    // --- Marcar um Presente Existente ---
                    docRef = doc(db, 'presentes', presenteId);
                    const presenteDoc = await transaction.get(docRef);

                    if (!presenteDoc.exists) {
                        throw new Error('Presente não encontrado no banco de dados.');
                    }
                    // Verifica se o presente já está marcado por outra pessoa
                    if (presenteDoc.data().status === 'marcado') {
                        throw new Error('Este presente já foi marcado por outra pessoa. Por favor, escolha outro.');
                    }

                    // Atualiza o documento no Firestore
                    transaction.update(docRef, {
                        status: 'marcado',
                        marcado_por_nome: nome,
                        marcado_por_telefone: telefone,
                        data_marcacao: FieldValue.serverTimestamp() // Usa o timestamp do servidor
                    });
                } else {
                    // --- Criar um Novo Presente "Outros" ---
                    // Cria uma referência para um novo documento com ID automático
                    docRef = doc(presentesCollection);
                    presentData = {
                        nome_presente: presenteNome,
                        status: 'marcado', // Já nasce marcado
                        marcado_por_nome: nome,
                        marcado_por_telefone: telefone,
                        data_marcacao: FieldValue.serverTimestamp()
                    };
                    transaction.set(docRef, presentData); // 'set' cria o novo documento
                    presenteId = docRef.id; // Pega o ID gerado para a mensagem de confirmação
                }
            });

            // --- Sucesso na Marcação/Criação ---
            console.log(`Presente "${presenteNome}" marcado por ${nome}`);
            confirmedPresentText.textContent = `Você escolheu: ${presenteNome}`;
            presentForm.classList.add('hidden'); // Esconde o formulário
            confirmationMessage.classList.remove('hidden'); // Mostra a mensagem de sucesso

            // Limpa os campos do formulário para uma nova interação (se o usuário voltar)
            document.getElementById('nome').value = '';
            document.getElementById('telefone').value = '';
            if (otherPresentNameInput) {
                otherPresentNameInput.value = '';
                otherPresentNameInput.disabled = true;
                otherPresentNameInput.required = false;
            }
            // A lista será automaticamente atualizada via onSnapshot

        } catch (error) {
            // --- Erro na Transação ---
            console.error('Erro ao marcar presente:', error);
            if (error.message.includes('já foi marcado')) {
                alert(error.message + ' A lista será atualizada automaticamente para refletir isso.');
            } else {
                alert('Ocorreu um erro ao marcar o presente. Por favor, tente novamente. Detalhes: ' + error.message);
            }
            // A função onSnapshot já se encarregará de recarregar a lista se houver uma mudança
            // ou se for um erro de concorrência, o onSnapshot já recarregará a lista.
        } finally {
            // Garante que a validação do formulário seja feita, mesmo em caso de erro,
            // para redefinir o estado do botão "Confirmar Escolha".
            checkFormValidity();
        }
    });

    // Chama a validação inicial do formulário quando a página é carregada pela primeira vez
    checkFormValidity();
});