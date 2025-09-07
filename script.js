// Importa as funções necessárias do Firebase SDK (versão modular)
// A linha abaixo foi CORRIGIDA para importar serverTimestamp
import { getFirestore, collection, onSnapshot, doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-analytics.js";


// Sua configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyB84iRetqiIBm9cnFHzreb0OIE_Z-8SS94",
    authDomain: "listapresentesdaniel.firebaseapp.com",
    projectId: "listapresentesdaniel",
    storageBucket: "listapresentesdaniel.firebasestorage.app",
    messagingSenderId: "527103687928",
    appId: "1:527103687928:web:0702c99cb2ad4142a4cf0d",
    measurementId: "G-K02JJKWPWQ"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);


document.addEventListener('DOMContentLoaded', () => {
    // Referências aos elementos HTML
    const presentForm = document.getElementById('presentForm');
    const presentListDiv = document.getElementById('presentList');
    const confirmationMessage = document.getElementById('confirmationMessage');
    const confirmedPresentText = document.getElementById('confirmedPresentText');
    const confirmButton = document.getElementById('confirmButton');

    const presentesCollection = collection(db, 'presentes');

    // Sincronização em Tempo Real com Firestore
    onSnapshot(presentesCollection, (snapshot) => {
        const presents = [];
        snapshot.forEach(doc => {
            presents.push({ id: doc.id, ...doc.data() });
        });
        renderPresents(presents);
        checkFormValidity();
    }, (error) => {
        console.error('Erro ao observar mudanças no Firestore:', error);
        presentListDiv.innerHTML = '<p>Erro ao carregar os presentes. Por favor, tente novamente.</p>';
    });

    // Função para Renderizar os Presentes na Interface
    function renderPresents(presents) {
        presentListDiv.innerHTML = '';
        presents.sort((a, b) => a.nome_presente.localeCompare(b.nome_presente));

        presents.forEach(present => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = 'presente';
            checkbox.value = present.id;
            checkbox.dataset.name = present.nome_presente;

            const span = document.createElement('span');
            span.textContent = present.nome_presente;

            if (present.status === 'marcado') {
                checkbox.disabled = true;
                checkbox.checked = true;
                label.classList.add('marked');
                span.textContent += ` (Marcado por: ${present.marcado_por_nome || 'Alguém'})`;
            }

            label.appendChild(checkbox);
            label.appendChild(span);
            presentListDiv.appendChild(label);
        });

        presentListDiv.addEventListener('change', handleCheckboxChange);
        document.getElementById('nome').addEventListener('input', checkFormValidity);
        document.getElementById('telefone').addEventListener('input', checkFormValidity);
    }

    // Função para Lidar com a Seleção de Checkboxes (Seleção Única)
    function handleCheckboxChange(event) {
        if (event.target.type === 'checkbox' && event.target.name === 'presente') {
            const checkboxes = presentListDiv.querySelectorAll('input[type="checkbox"]:not(:disabled)');
            checkboxes.forEach(cb => {
                if (cb !== event.target) {
                    cb.checked = false;
                }
            });
            checkFormValidity();
        }
    }

    // Função para Verificar a Validade do Formulário
    function checkFormValidity() {
        const nome = document.getElementById('nome').value.trim();
        const telefone = document.getElementById('telefone').value.replace(/\D/g, ''); // Remove não-dígitos
        const selectedCheckbox = document.querySelector('#presentList input[type="checkbox"]:checked:not(:disabled)');
        const isFormValid = nome && telefone.length >= 10 && selectedCheckbox;
        confirmButton.disabled = !isFormValid;
    }

    // Lidar com o Envio do Formulário
    presentForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const nome = document.getElementById('nome').value.trim();
        const telefone = document.getElementById('telefone').value.trim();
        const selectedCheckbox = document.querySelector('#presentList input[type="checkbox"]:checked:not(:disabled)');

        if (!nome || !telefone || !selectedCheckbox) {
            alert('Por favor, preencha todos os campos e selecione um presente.');
            return;
        }

        const presenteId = selectedCheckbox.value;
        const presenteNome = selectedCheckbox.dataset.name;

        try {
            await runTransaction(db, async (transaction) => {
                const docRef = doc(db, 'presentes', presenteId);
                const presenteDoc = await transaction.get(docRef);

                if (!presenteDoc.exists()) {
                    throw new Error('Presente não encontrado no banco de dados.');
                }
                
                if (presenteDoc.data().status === 'marcado') {
                    throw new Error('Este presente já foi marcado por outra pessoa. Por favor, escolha outro.');
                }

                transaction.update(docRef, {
                    status: 'marcado',
                    marcado_por_nome: nome,
                    marcado_por_telefone: telefone,
                    // A linha abaixo foi CORRIGIDA para usar a função importada
                    data_marcacao: serverTimestamp() 
                });
            });

            // Sucesso na Marcação
            console.log(`Presente "${presenteNome}" marcado por ${nome}`);
            confirmedPresentText.textContent = `Você escolheu: ${presenteNome}`;
            presentForm.classList.add('hidden');
            confirmationMessage.classList.remove('hidden');

            document.getElementById('nome').value = '';
            document.getElementById('telefone').value = '';

        } catch (error) {
            console.error('Erro ao marcar presente:', error);
            if (error.message.includes('já foi marcado')) {
                alert(error.message + ' A lista será atualizada automaticamente.');
            } else {
                alert('Ocorreu um erro ao marcar o presente. Tente novamente. Detalhes: ' + error.message);
            }
        } finally {
            checkFormValidity();
        }
    });

    // Validação inicial
    checkFormValidity();
});