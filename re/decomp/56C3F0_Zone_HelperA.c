_DWORD *__thiscall sub_56C210(_DWORD *this, _DWORD *a2)
{
  int v3; // esi
  int v4; // edi
  int *v5; // ecx
  __int16 v6; // ax
  __int16 v7; // cx
  int v8; // edi
  int v9; // eax
  int v10; // ebp
  int v11; // ecx
  unsigned int v12; // eax
  _DWORD *v13; // eax
  _DWORD *i; // esi
  int v15; // eax
  int v16; // eax
  _DWORD *v17; // eax
  _DWORD *v18; // eax
  _DWORD *result; // eax
  _DWORD *v21; // [esp+14h] [ebp-4Ch]
  int v22; // [esp+18h] [ebp-48h]
  int v23; // [esp+1Ch] [ebp-44h]
  int *v24; // [esp+20h] [ebp-40h]
  _DWORD v25[3]; // [esp+24h] [ebp-3Ch] BYREF
  _DWORD v26[3]; // [esp+30h] [ebp-30h] BYREF
  char v27[12]; // [esp+3Ch] [ebp-24h] BYREF
  char v28[12]; // [esp+48h] [ebp-18h] BYREF
  __int16 v29; // [esp+64h] [ebp+4h]
  __int16 v30; // [esp+66h] [ebp+6h]

  v21 = nullptr;
  v22 = 0;
  v3 = *a2 / 256;
  v4 = a2[1] / 256;
  v29 = v3;
  v30 = v4;
  if ( (byte_ABDC28 & 1) == 0 )
  {
    dword_ABD434 = 0;
    byte_ABDC28 |= 1u;
    dword_ABD438 = 0xFFFF;
    dword_ABD43C = 1;
    dword_ABD444 = 0x10000;
    dword_ABD448 = 0x1FFFF;
    dword_ABD440 = -65536;
    dword_ABD44C = 65537;
    dword_ABD450 = -65535;
    dword_ABD454 = -1;
    atexit(nullsub_167);
  }
  v5 = &dword_ABD434;
  v24 = &dword_ABD434;
  while ( 1 )
  {
    v6 = *(_WORD *)v5;
    v7 = v4 + *((_WORD *)v5 + 1);
    LOWORD(v23) = v3 + v6;
    v8 = (__int16)(v3 + v6);
    v9 = *(this + 61);
    HIWORD(v23) = v7;
    v10 = v7;
    v11 = v8 + v7;
    if ( v11 > v9 && v8 - v10 < v9 && v10 - v8 < v9 && v11 <= v9 + 2 * *(this + 62) )
    {
      v12 = v8 + (v10 << 9);
      if ( v12 >= 0x40000 || (v13 = *(_DWORD **)(*(this + 79) + 4 * v12)) == nullptr )
      {
        dword_ABDC74 = v23;
        v13 = &unk_ABDC50;
      }
      for ( i = (_DWORD *)v13[57]; i != nullptr; i = (_DWORD *)i[12] )
      {
        if ( (i[5] & 1) == 0 || *((_BYTE *)i + 1050) != 0 || i[136] != 2 )
        {
          if ( (*(int (__thiscall **)(_DWORD *))(*i + 44))(i) != 6 )
          {
            v17 = (_DWORD *)(*(int (__thiscall **)(_DWORD *, char *))(*i + 72))(i, v28);
            v18 = (_DWORD *)sub_41C230(*a2 - *v17, a2[1] - v17[1], a2[2] - v17[2]);
            v26[0] = *v18;
            v26[1] = v18[1];
            v26[2] = v18[2];
            v16 = sub_41C380(v26);
LABEL_20:
            if ( v16 >= 0 && (v21 == nullptr || v16 < v22) )
            {
              v22 = v16;
              v21 = i;
            }
            continue;
          }
          v25[0] = (v8 << 8) + 128;
          v25[1] = (v10 << 8) + 128;
          v25[2] = 0;
          v15 = sub_437160(v27, v25);
          v16 = sub_41C380(v15);
          if ( v16 <= 181 )
            goto LABEL_20;
        }
      }
      LOWORD(v3) = v29;
    }
    v5 = ++v24;
    if ( (int)v24 >= (int)&dbl_ABD458 )
      break;
    LOWORD(v4) = v30;
  }
  result = v21;
  if ( v21 != nullptr && v22 > 181 )
    return nullptr;
  return result;
}
