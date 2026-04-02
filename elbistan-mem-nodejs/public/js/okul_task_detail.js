                                                        if (messagesBox) {
                                                            messagesBox.scrollTop = messagesBox.scrollHeight;
                                                        }

                                                        function updateFileName(input) {
                                                            const nameDiv = document.getElementById('selected-file-name');
                                                            if (input.files && input.files[0]) {
                                                                nameDiv.style.display = 'block';
                                                                nameDiv.querySelector('span').textContent = input.files[0].name;
                                                            } else {
                                                                nameDiv.style.display = 'none';
                                                            }
                                                        }