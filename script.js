// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-analytics.js";
import { getFirestore, collection, onSnapshot, doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";


// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyB84iRetqiIBm9cnFHzreb0OIE_Z-8SS94",
    authDomain: "listapresentesdaniel.firebaseapp.com",
    projectId: "listapresentesdaniel",
    storageBucket: "listapresentesdaniel.firebasestorage.app",
    messagingSenderId: "527103687928",
    appId: "1:527103687928:web:0702c99cb2ad4142a4cf0d",
    measurementId: "G-K02JJKWPWQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); // Se você realmente quiser usar Analytics
const db = getFirestore(app); // Obtém a instância do Firestore


document.addEventListener('DOMContentLoaded', () => {
    const presentForm = document.getElementById('presentForm');
    const presentListDiv = document.getElementById('presentList');
    const confirmationMessage = document.getElementById('confirmationMessage');
    const confirmedPresentText = document.getElementById('confirmedPresentText');

    // Referência à coleção 'presentes' no Firestore (sintaxe modular)
    const presentesCollection = collection(db, 'presentes');

    // Listener em tempo real para as mudanças nos presentes
    onSnapshot(presentesCollection, (snapshot) => {
        const presents = [];
        snapshot.forEach(doc => {
            presents.push({ id: doc.id, ...doc.data() });
        });
        renderPresents(presents);
    }, (error) => {
        console.error('Erro ao observar mudanças no Firestore:', error);
        presentListDiv.innerHTML = '<p>Erro ao carregar os presentes. Por favor, tente novamente.</p>';
    });

    // Função para renderizar os presentes na interface
    function renderPresents(presents) {
        presentListDiv.innerHTML = ''; // Limpa a lista atual

        // Ordena os presentes para garantir que a ordem seja consistente
        presents.sort((a, b) => a.nome_presente.localeCompare(b.nome_presente));

        presents.forEach(present => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = 'presente';
            checkbox.value = present.id; // Usar o ID do documento do Firestore
            checkbox.dataset.name = present.nome_presente; // Guardar o nome para exibição

            const span = document.createElement('span');
            span.textContent = present.nome_presente;

            if (present.status === 'marcado') {
                checkbox.disabled = true; // Desabilita se já estiver marcado
                checkbox.checked = true; // Marca visualmente
                label.classList.add('marked'); // Adiciona estilo visual
                span.textContent += ` (Marcado por: ${present.marcado_por_nome || 'Alguém'})`;
            }

            label.appendChild(checkbox);
            label.appendChild(span);
            presentListDiv.appendChild(label);
        });

        // Adiciona o listener para seleção única APENAS para os checkboxes não desabilitados
        const availableCheckboxes = presentListDiv.querySelectorAll('input[type="checkbox"]:not(:disabled)');
        // É importante remover e adicionar o event listener para evitar múltiplos listeners em cada renderização
        // Uma abordagem mais robusta seria delegar o evento para um elemento pai.
        // No entanto, para simplicidade aqui, vamos apenas re-adicionar para os novos elementos.
        // O `onSnapshot` garante que a lista é sempre redesenhada, então listeners antigos são descartados.
        presentListDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.removeEventListener('change', handleCheckboxChange); // Remove listeners antigos
        });
        presentListDiv.addEventListener('change', handleCheckboxChange); // Adiciona um novo listener principal
    }

    function handleCheckboxChange(event) {
        if (event.target.type === 'checkbox' && event.target.name === 'presente') {
            const checkboxes = presentListDiv.querySelectorAll('input[type="checkbox"]:not(:disabled)');
            checkboxes.forEach(cb => {
                if (cb !== event.target) {
                    cb.checked = false; // Garante seleção única
                }
            });
        }
    }


    // Lidar com o envio do formulário
    presentForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const nome = document.getElementById('nome').value.trim();
        const telefone = document.getElementById('telefone').value.trim();
        const selectedCheckbox = Array.from(presentListDiv.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)'));

        if (!nome || !telefone) {
            alert('Por favor, preencha seu nome e telefone.');
            return;
        }
        if (selectedCheckbox.length === 0) {
            alert('Por favor, escolha um presente para marcar.');
            return;
        }
        if (selectedCheckbox.length > 1) {
             alert('Por favor, selecione apenas um presente.');
             return;
        }

        const presenteId = selectedCheckbox[0].value;
        const presenteNome = selectedCheckbox[0].dataset.name;

        try {
            await runTransaction(db, async (transaction) => { // Usando runTransaction da modular API
                const presenteRef = doc(db, 'presentes', presenteId); // Usando doc da modular API
                const presenteDoc = await transaction.get(presenteRef);

                if (!presenteDoc.exists) {
                    throw new Error('Presente não encontrado.');
                }

                if (presenteDoc.data().status === 'marcado') {
                    throw new Error('Este presente já foi marcado por outra pessoa. Por favor, escolha outro.');
                }

                transaction.update(presenteRef, {
                    status: 'marcado',
                    marcado_por_nome: nome,
                    marcado_por_telefone: telefone,
                    data_marcacao: serverTimestamp() // Usando FieldValue da modular API
                });
            });

            console.log(`Presente "${presenteNome}" marcado por ${nome}`);
            confirmedPresentText.textContent = `Você escolheu: ${presenteNome}`;
            presentForm.classList.add('hidden');
            confirmationMessage.classList.remove('hidden');

        } catch (error) {
            console.error('Erro ao marcar presente:', error);
            if (error.message.includes('já foi marcado')) {
                alert(error.message + ' A lista será atualizada.');
            } else {
                alert('Ocorreu um erro ao marcar o presente. Por favor, tente novamente. Detalhes: ' + error.message);
            }
        }
    });
});