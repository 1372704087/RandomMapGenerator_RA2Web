// 0x7a2330 watch_7A2330 size=2C2

int __thiscall sub_7A2330(const char *this)
{
  char *v1; // esi
  char *v2; // eax
  char *v3; // eax
  int v4; // ebx
  char *v5; // ebp
  char *v6; // eax
  char *v7; // esi
  char *v8; // eax
  char *v9; // eax
  int v10; // ebx
  char *v11; // ebp
  char *v12; // eax
  HWND v13; // eax
  char v14; // bl
  int v15; // esi
  char *v16; // eax
  char *v17; // ebp
  wchar_t *v18; // eax
  int v19; // edi
  int v20; // eax
  int result; // eax
  char *v22; // [esp+10h] [ebp-104h] BYREF
  char String[256]; // [esp+14h] [ebp-100h] BYREF

  strcpy(String, this);
  v1 = strtok(String, asc_84D68C);
  v2 = strtok(nullptr, Delimiter);
  atol(v2);
  v3 = strtok(nullptr, Delimiter);
  v4 = atol(v3);
  v5 = strtok(nullptr, Delimiter);
  v22 = strtok(nullptr, Delimiter);
  v6 = strtok(nullptr, Delimiter);
  sub_7A2230(v1, v5, v22, v6);
  sub_7B4630(v1);
  sub_77ED00(v4, -2, -2);
  sub_7B46F0(&v22);
  v7 = strtok(nullptr, Delimiter);
  v8 = strtok(nullptr, Delimiter);
  atol(v8);
  v9 = strtok(nullptr, Delimiter);
  v10 = atol(v9);
  v11 = strtok(nullptr, Delimiter);
  v22 = strtok(nullptr, Delimiter);
  v12 = strtok(nullptr, Delimiter);
  sub_7A2230(v7, v11, v22, v12);
  sub_7B4630(v7);
  sub_77ED00(v10, -2, -2);
  sub_7B46F0(&v22);
  dword_ABE028 = 4;
  strcpy(&Destination, aRandmapSed);
  dword_A8B254 = -1;
  v13 = (HWND)sub_775940(287);
  sub_595FB0(v13, sub_77D710);
  sub_597730(aRandmapSed);
  v14 = 0;
  v15 = 0;
  if ( dword_A8B8D8 > 0 )
  {
    while ( (unsigned __int8)sub_69ADF0(*(_DWORD *)(dword_A8B8CC + 4 * v15)) == 0 )
    {
      if ( ++v15 >= dword_A8B8D8 )
        goto LABEL_6;
    }
    v14 = 1;
  }
LABEL_6:
  v16 = (char *)sub_5E84D0();
  v17 = v16;
  if ( v14 != 0 )
  {
    sub_69AD80(v16);
    sub_69ACD0(*(wchar_t **)(dword_A8B8CC + 4 * v15), &word_ABE050);
  }
  else
  {
    v18 = (wchar_t *)operator new(0x1BCu);
    if ( v18 != nullptr )
      v19 = sub_69A980(v18, aRandmapSed, &word_ABE050, v17, 1, 0, 2, 4);
    else
      v19 = 0;
    if ( dword_A8B8D8 < dword_A8B8D0
      || (byte_A8B8D5 != 0 || dword_A8B8D0 == 0)
      && dword_A8B8DC > 0
      && (*(unsigned __int8 (__thiscall **)(int *, int, _DWORD))(dword_A8B8C8 + 8))(
           &dword_A8B8C8,
           dword_A8B8DC + dword_A8B8D0,
           0) != 0 )
    {
      v20 = dword_A8B8D8++;
      *(_DWORD *)(dword_A8B8CC + 4 * v20) = v19;
    }
  }
  operator delete(v17);
  result = sub_5E7BF0(v15);
  if ( (_BYTE)result == 1 )
    dword_A8B254 = v15;
  return result;
}
